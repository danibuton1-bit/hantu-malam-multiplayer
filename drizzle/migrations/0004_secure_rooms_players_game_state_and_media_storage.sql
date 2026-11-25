-- 1. Remove overly permissive policies on rooms, players, game_state, and game-media storage
DROP POLICY IF EXISTS "rooms open" ON public.rooms;
DROP POLICY IF EXISTS "players open" ON public.players;
DROP POLICY IF EXISTS "state open" ON public.game_state;
DROP POLICY IF EXISTS "game media public read" ON storage.objects;

-- 2. Restrict table privileges on rooms, players, game_state to read-only for client roles
REVOKE INSERT, UPDATE, DELETE ON public.rooms FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.players FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.game_state FROM anon, authenticated;

GRANT SELECT ON public.rooms TO anon, authenticated;
GRANT SELECT ON public.players TO anon, authenticated;
GRANT SELECT ON public.game_state TO anon, authenticated;

GRANT ALL ON public.rooms TO service_role;
GRANT ALL ON public.players TO service_role;
GRANT ALL ON public.game_state TO service_role;

-- 3. Scoped SELECT policies (non-tautology, active/recent 24h matches only)
CREATE POLICY "recent rooms readable"
  ON public.rooms
  FOR SELECT
  TO anon, authenticated
  USING (status IN ('lobby', 'playing', 'ended') AND created_at > now() - interval '24 hours');

CREATE POLICY "recent players readable"
  ON public.players
  FOR SELECT
  TO anon, authenticated
  USING (
    joined_at > now() - interval '24 hours'
    AND EXISTS (
      SELECT 1 FROM public.rooms r
      WHERE r.code = players.room_code
        AND r.status IN ('lobby', 'playing', 'ended')
    )
  );

CREATE POLICY "recent game state readable"
  ON public.game_state
  FOR SELECT
  TO anon, authenticated
  USING (
    updated_at > now() - interval '24 hours'
    AND EXISTS (
      SELECT 1 FROM public.rooms r
      WHERE r.code = game_state.room_code
        AND r.status IN ('playing', 'ended')
    )
  );

-- 4. Verified SECURITY DEFINER RPCs for room, player, and match mutations

CREATE OR REPLACE FUNCTION public.create_squad_room(p_id uuid, p_kode text, p_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_code text := upper(trim(coalesce(p_code, '')));
BEGIN
  IF NOT public.me_ok(p_id, p_kode) THEN
    RAISE EXCEPTION 'Kartu ID tidak valid';
  END IF;
  IF v_code !~ '^[A-Z0-9]{4}$' THEN
    RAISE EXCEPTION 'Kode room tidak valid';
  END IF;
  INSERT INTO public.rooms (code, host_id)
  VALUES (v_code, p_id)
  ON CONFLICT (code) DO NOTHING;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.join_squad_room(p_id uuid, p_kode text, p_code text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  me public.profiles;
  rm public.rooms;
  v_code text := upper(trim(coalesce(p_code, '')));
  v_exists boolean;
  v_count integer;
  v_max integer;
BEGIN
  SELECT * INTO me FROM public.profiles WHERE id = p_id AND kode_id = p_kode;
  IF me.id IS NULL THEN
    RAISE EXCEPTION 'Kartu ID tidak valid';
  END IF;

  SELECT * INTO rm FROM public.rooms WHERE code = v_code;
  IF rm.code IS NULL THEN
    RETURN 'notfound';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.players WHERE room_code = v_code AND profile_id = me.id
  ) INTO v_exists;

  IF NOT v_exists THEN
    v_max := CASE rm.team_mode WHEN 'solo' THEN 1 WHEN 'duo' THEN 2 ELSE 4 END;
    SELECT count(*) INTO v_count FROM public.players WHERE room_code = v_code;
    IF rm.status <> 'lobby' OR v_count >= v_max THEN
      RETURN 'full';
    END IF;
    INSERT INTO public.players (room_code, profile_id, nama, username, karakter)
    VALUES (v_code, me.id, me.nama, me.username, me.karakter_pilihan);
  END IF;

  DELETE FROM public.players WHERE profile_id = me.id AND room_code <> v_code;
  RETURN 'ok';
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_squad_room(p_id uuid, p_kode text, p_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.me_ok(p_id, p_kode) THEN
    RAISE EXCEPTION 'Kartu ID tidak valid';
  END IF;
  DELETE FROM public.players WHERE room_code = upper(trim(p_code)) AND profile_id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.kick_offline_player(p_id uuid, p_kode text, p_code text, p_target_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_code text := upper(trim(p_code));
BEGIN
  IF NOT public.me_ok(p_id, p_kode) THEN
    RAISE EXCEPTION 'Kartu ID tidak valid';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.players WHERE room_code = v_code AND profile_id = p_id) THEN
    RAISE EXCEPTION 'Bukan anggota squad';
  END IF;
  DELETE FROM public.players WHERE room_code = v_code AND profile_id = p_target_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_room_countdown(p_id uuid, p_kode text, p_code text, p_until timestamptz)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_code text := upper(trim(p_code));
  v_captain uuid;
BEGIN
  IF NOT public.me_ok(p_id, p_kode) THEN
    RAISE EXCEPTION 'Kartu ID tidak valid';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.players WHERE room_code = v_code AND profile_id = p_id) THEN
    RAISE EXCEPTION 'Bukan anggota squad';
  END IF;
  IF p_until IS NOT NULL THEN
    SELECT profile_id INTO v_captain FROM public.players WHERE room_code = v_code ORDER BY joined_at ASC LIMIT 1;
    IF v_captain IS DISTINCT FROM p_id THEN
      RAISE EXCEPTION 'Hanya kapten yang dapat memulai hitung mundur';
    END IF;
  END IF;
  UPDATE public.rooms SET countdown_until = p_until WHERE code = v_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_room_mode(p_id uuid, p_kode text, p_code text, p_map text, p_team_mode text, p_bots boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_code text := upper(trim(p_code));
BEGIN
  IF NOT public.me_ok(p_id, p_kode) THEN
    RAISE EXCEPTION 'Kartu ID tidak valid';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.players WHERE room_code = v_code AND profile_id = p_id) THEN
    RAISE EXCEPTION 'Bukan anggota squad';
  END IF;
  IF p_map NOT IN ('rumah', 'rumahsakit', 'kuburan', 'hotel', 'petak') THEN
    RAISE EXCEPTION 'Map tidak valid';
  END IF;
  IF p_team_mode NOT IN ('solo', 'duo', 'squad') THEN
    RAISE EXCEPTION 'Mode tim tidak valid';
  END IF;
  UPDATE public.rooms
  SET map = p_map, team_mode = p_team_mode, bots = coalesce(p_bots, true)
  WHERE code = v_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_player_pref(p_id uuid, p_kode text, p_code text, p_pref text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.me_ok(p_id, p_kode) THEN
    RAISE EXCEPTION 'Kartu ID tidak valid';
  END IF;
  IF p_pref NOT IN ('hunter', 'ghost') THEN
    RAISE EXCEPTION 'Pilihan peran tidak valid';
  END IF;
  UPDATE public.players
  SET role_pref = p_pref
  WHERE room_code = upper(trim(p_code)) AND profile_id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_player_status(p_id uuid, p_kode text, p_code text, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.me_ok(p_id, p_kode) THEN
    RAISE EXCEPTION 'Kartu ID tidak valid';
  END IF;
  IF p_status NOT IN ('alive', 'caught', 'escaped') THEN
    RAISE EXCEPTION 'Status tidak valid';
  END IF;
  UPDATE public.players
  SET status = p_status
  WHERE room_code = upper(trim(p_code)) AND profile_id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.start_room_match(p_id uuid, p_kode text, p_code text, p_roles jsonb, p_started_at timestamptz)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_code text := upper(trim(p_code));
BEGIN
  IF NOT public.me_ok(p_id, p_kode) THEN
    RAISE EXCEPTION 'Kartu ID tidak valid';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.players WHERE room_code = v_code AND profile_id = p_id) THEN
    RAISE EXCEPTION 'Bukan anggota squad';
  END IF;

  UPDATE public.players
  SET role = CASE WHEN (p_roles ->> profile_id::text) = 'ghost' THEN 'ghost' ELSE 'hunter' END,
      status = 'alive'
  WHERE room_code = v_code;

  INSERT INTO public.game_state (room_code, keys_found, started_at, winner, updated_at)
  VALUES (v_code, 0, coalesce(p_started_at, now() + interval '3 seconds'), NULL, now())
  ON CONFLICT (room_code) DO UPDATE
  SET keys_found = 0,
      started_at = EXCLUDED.started_at,
      winner = NULL,
      updated_at = now();

  UPDATE public.rooms
  SET status = 'playing', countdown_until = NULL
  WHERE code = v_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_room_match(p_id uuid, p_kode text, p_code text, p_winner text, p_keys_found integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_code text := upper(trim(p_code));
BEGIN
  IF NOT public.me_ok(p_id, p_kode) THEN
    RAISE EXCEPTION 'Kartu ID tidak valid';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.players WHERE room_code = v_code AND profile_id = p_id) THEN
    RAISE EXCEPTION 'Bukan anggota squad';
  END IF;

  UPDATE public.game_state
  SET winner = p_winner,
      keys_found = greatest(0, least(5, coalesce(p_keys_found, 0))),
      updated_at = now()
  WHERE room_code = v_code;

  UPDATE public.rooms
  SET status = 'ended'
  WHERE code = v_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_room_to_lobby(p_id uuid, p_kode text, p_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_code text := upper(trim(p_code));
BEGIN
  IF NOT public.me_ok(p_id, p_kode) THEN
    RAISE EXCEPTION 'Kartu ID tidak valid';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.players WHERE room_code = v_code AND profile_id = p_id) THEN
    RAISE EXCEPTION 'Bukan anggota squad';
  END IF;

  UPDATE public.players
  SET role = NULL, status = 'alive'
  WHERE room_code = v_code;

  UPDATE public.rooms
  SET status = 'lobby', countdown_until = NULL
  WHERE code = v_code;
END;
$$;