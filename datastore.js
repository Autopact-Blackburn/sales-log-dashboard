import { CONFIG } from './config.js';

const { createClient } = supabase;

export const supabaseClient = createClient(
  CONFIG.SUPABASE_URL,
  CONFIG.SUPABASE_ANON_KEY
);

export async function validateSession() {
  const { data, error } = await supabaseClient.auth.getSession();

  if (error || !data.session) {
    window.location.href = 'index.html';
    return null;
  }

  return data.session;
}

export async function loadDeals() {
  const { data, error } = await supabaseClient
    .from('deals')
    .select('*')
    .order('eta_date', {
      ascending: true,
      nullsFirst: false
    });

  if (error) {
    console.error('LOAD DEALS FAILED:', error);
    throw new Error(error.message || 'Could not load deals');
  }

  return data || [];
}

export async function upsertDeals(deals) {
  if (!Array.isArray(deals) || !deals.length) {
    return;
  }

  const safeRows = deals.map(deal => {
    return {
      deal_no: deal.deal_no,
      dept_code: deal.dept_code || null,
      customer_name: deal.customer_name || null,
      salesperson: deal.salesperson || null,
      vehicle_description: deal.vehicle_description || null,
      eta_date: deal.eta_date || null,
      gross: deal.gross ?? null,
      last_imported_at: new Date().toISOString()
    };
  });

  const chunkSize = 100;

  for (let i = 0; i < safeRows.length; i += chunkSize) {
    const chunk = safeRows.slice(i, i + chunkSize);

    const { error } = await supabaseClient
      .from('deals')
      .upsert(chunk, {
        onConflict: 'deal_no'
      });

    if (error) {
      console.error('UPSERT FAILED:', error);
      throw new Error(error.message || 'Deal upload failed');
    }
  }
}

export async function updateDealField(id, field, value) {
  const allowedFields = [
    'status',
    'notes',
    'payment_method',
    'priority',
    'finance_approved',
    'delivery_confirmed'
  ];

  if (!allowedFields.includes(field)) {
    throw new Error(`Field not allowed for manual update: ${field}`);
  }

  const { error } = await supabaseClient
    .from('deals')
    .update({
      [field]: value,
      updated_at: new Date().toISOString()
    })
    .eq('id', id);

  if (error) {
    console.error('UPDATE DEAL FIELD FAILED:', error);
    throw new Error(error.message || 'Update failed');
  }
}

export function setupRealtime(onChange) {
  supabaseClient
    .channel('deals-realtime')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'deals'
      },
      async payload => {
        console.log('REALTIME CHANGE:', payload);

        if (typeof onChange === 'function') {
          await onChange(payload);
        }
      }
    )
    .subscribe();
}

export async function logout() {
  await supabaseClient.auth.signOut();
  window.location.href = 'index.html';
}