import { supabase } from './lib/supabase.js';

async function cleanDemoIfEmpty(){
  const { data, error } = await supabase.from('media').select('id').limit(1);
  if (error) return;
  document.body.classList.toggle('frame99-clean-empty', !data?.length);
}

cleanDemoIfEmpty();
setInterval(cleanDemoIfEmpty, 5000);
