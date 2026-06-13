import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { licenseKey, userId } = await req.json()

    if (!licenseKey || !userId) {
      return new Response(
        JSON.stringify({ licensed: false, message: "مفتاح الترخيص ومعرف المستخدم مطلوبان" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // 1. Fetch license
    const { data: license, error: fetchErr } = await supabaseClient
      .from('licenses')
      .select('*')
      .eq('license_key', licenseKey.toUpperCase())
      .single()

    if (fetchErr || !license) {
      return new Response(
        JSON.stringify({ licensed: false, message: "مفتاح الترخيص غير موجود" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // 2. Validate license status
    if (license.status !== 'active') {
      return new Response(
        JSON.stringify({ licensed: false, message: "الترخيص غير نشط أو تم حظره" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // 3. Check if bound to someone else
    if (license.user_id && license.user_id !== userId) {
      return new Response(
        JSON.stringify({ licensed: false, message: "هذا الترخيص مرتبط بحساب آخر بالفعل" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // 4. Bind license
    const { error: updateErr } = await supabaseClient
      .from('licenses')
      .update({
        user_id: userId,
        bound_at: new Date().toISOString(),
        last_check_in: new Date().toISOString()
      })
      .eq('id', license.id)

    if (updateErr) {
      return new Response(
        JSON.stringify({ licensed: false, message: "فشل تفعيل الترخيص في قاعدة البيانات" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    return new Response(
      JSON.stringify({
        licensed: true,
        message: "تم تفعيل الترخيص بنجاح",
        expiryDate: license.expires_at,
        features: license.features || {}
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ licensed: false, message: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
