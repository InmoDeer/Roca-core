ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_type_check;
ALTER TABLE activities ADD CONSTRAINT activities_type_check CHECK (type = ANY (ARRAY['call', 'whatsapp', 'visit', 'meeting', 'email', 'note']));

ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_channel_check;
ALTER TABLE activities ADD CONSTRAINT activities_channel_check CHECK (channel = ANY (ARRAY['phone', 'whatsapp', 'presencial', 'zoom', 'email', 'none']));
