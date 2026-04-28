import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildCorsHeaders, preflightResponse, type CorsOptions } from "../_shared/cors.ts"
import { getAccessToken } from "../_shared/auth.ts"

const corsOpts: CorsOptions = { methods: "POST, OPTIONS" }

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return preflightResponse(req, corsOpts)
  }
  const corsHeaders = buildCorsHeaders(req, corsOpts)

  try {
    const body = await req.json().catch(() => ({}))
    const userToken = getAccessToken(req, body)

    if (!userToken) {
      return new Response(
        JSON.stringify({ error: 'Token manquant' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: `Bearer ${userToken}` } } }
    )

    const { data: { user } } = await supabase.auth.getUser(userToken)
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Non authentifié' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('stripe_account_id')
      .eq('id', user.id)
      .single()

    if (!profile?.stripe_account_id) {
      return new Response(
        JSON.stringify({ error: 'Compte Stripe non trouvé' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const loginLink = await stripe.accounts.createLoginLink(
      profile.stripe_account_id
    )

    return new Response(
      JSON.stringify({ url: loginLink.url }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        }
      }
    )

  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        }
      }
    )
  }
})
