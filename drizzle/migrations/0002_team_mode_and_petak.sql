ALTER TABLE public.rooms DROP CONSTRAINT IF EXISTS rooms_map_check;
ALTER TABLE public.rooms ADD CONSTRAINT rooms_map_check CHECK (map IN ('rumah','rumahsakit','kuburan','hotel','petak'));
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS team_mode text NOT NULL DEFAULT 'squad';
ALTER TABLE public.rooms ADD CONSTRAINT rooms_team_mode_check CHECK (team_mode IN ('solo','duo','squad'));
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS bots boolean NOT NULL DEFAULT true;