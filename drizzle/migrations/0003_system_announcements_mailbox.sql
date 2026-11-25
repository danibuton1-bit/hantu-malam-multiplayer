CREATE TABLE public.system_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'info' CHECK (category IN ('info', 'update', 'event')),
  sender_nama TEXT NOT NULL DEFAULT 'Admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.system_announcements TO anon, authenticated;
GRANT ALL ON public.system_announcements TO service_role;

ALTER TABLE public.system_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "announcements readable"
ON public.system_announcements
FOR SELECT
TO anon, authenticated
USING (true);

CREATE OR REPLACE FUNCTION public.publish_announcement(
  p_id UUID,
  p_kode TEXT,
  p_title TEXT,
  p_body TEXT,
  p_category TEXT DEFAULT 'info'
)
RETURNS public.system_announcements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title TEXT := btrim(coalesce(p_title, ''));
  v_body TEXT := btrim(coalesce(p_body, ''));
  v_cat TEXT := CASE WHEN p_category IN ('info', 'update', 'event') THEN p_category ELSE 'info' END;
  v_sender TEXT;
  v_row public.system_announcements;
BEGIN
  IF NOT public.is_admin(p_id, p_kode) THEN
    RAISE EXCEPTION 'Hanya admin yang dapat mengirim pengumuman';
  END IF;
  IF length(v_title) = 0 OR length(v_title) > 120 THEN
    RAISE EXCEPTION 'Judul harus diisi (maks 120 karakter)';
  END IF;
  IF length(v_body) = 0 OR length(v_body) > 2000 THEN
    RAISE EXCEPTION 'Isi pesan harus diisi (maks 2000 karakter)';
  END IF;
  SELECT nama INTO v_sender FROM public.profiles WHERE id = p_id;
  INSERT INTO public.system_announcements (title, body, category, sender_nama)
  VALUES (v_title, v_body, v_cat, coalesce(v_sender, 'Admin'))
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_announcement(
  p_id UUID,
  p_kode TEXT,
  p_announcement_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(p_id, p_kode) THEN
    RAISE EXCEPTION 'Hanya admin yang dapat menghapus pengumuman';
  END IF;
  DELETE FROM public.system_announcements WHERE id = p_announcement_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.publish_announcement(UUID, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_announcement(UUID, TEXT, UUID) TO anon, authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.system_announcements;