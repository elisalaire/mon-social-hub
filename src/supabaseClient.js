import { createClient } from '@supabase/supabase-js'

// Remplace les valeurs ci-dessous par celles que tu as trouvées sur Supabase
const supabaseUrl = 'https://pwanvzmrimdvzlomhnpe.supabase.co' 
const supabaseAnonKey = 'sb_publishable_0kjwivAKo-B_8AisAA-1Nw_rlqMmAJJ'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

