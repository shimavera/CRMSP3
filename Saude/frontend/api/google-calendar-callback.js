// Vercel Serverless Function: Google Calendar OAuth Callback
// Recebe o código de autorização do Google, troca por tokens e salva no Supabase

export default async function handler(req, res) {
    const { code, state, error: authError } = req.query;

    // Decodificar state (contém company_id e return_url)
    let stateData;
    try {
        stateData = JSON.parse(Buffer.from(state || '', 'base64url').toString());
    } catch {
        try {
            stateData = JSON.parse(Buffer.from(state || '', 'base64').toString());
        } catch {
            stateData = { company_id: null, return_url: '/' };
        }
    }

    const returnUrl = stateData.return_url || '/';

    // Se o usuário negou ou houve erro
    if (authError || !code) {
        return res.redirect(302, `${returnUrl}?google_error=${authError || 'no_code'}`);
    }

    if (!stateData.company_id) {
        return res.redirect(302, `${returnUrl}?google_error=invalid_state`);
    }

    try {
        // Trocar o código por tokens no Google
        const redirectUri = `https://${req.headers.host}/api/google-calendar-callback`;

        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: process.env.GOOGLE_CLIENT_ID,
                client_secret: process.env.GOOGLE_CLIENT_SECRET,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code',
            }).toString(),
        });

        const tokens = await tokenRes.json();

        if (tokens.error) {
            console.error('Google token error:', tokens);
            return res.redirect(302, `${returnUrl}?google_error=${tokens.error}`);
        }

        // Calcular expiração do token
        const expiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

        // Salvar tokens no Supabase via REST API (upsert)
        const updateData = {
            company_id: stateData.company_id,
            google_access_token: tokens.access_token,
            google_token_expiry: expiry,
            google_calendar_id: 'primary',
        };

        if (tokens.refresh_token) {
            updateData.google_refresh_token = tokens.refresh_token;
        }

        const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        const dbRes = await fetch(
            `${supabaseUrl}/rest/v1/sp3_calendar_settings?company_id=eq.${stateData.company_id}`,
            {
                method: 'PATCH',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal',
                },
                body: JSON.stringify(updateData),
            }
        );

        if (!dbRes.ok) {
            // Se PATCH falhou (row não existe), tentar INSERT
            const insertRes = await fetch(`${supabaseUrl}/rest/v1/sp3_calendar_settings`, {
                method: 'POST',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'resolution=merge-duplicates,return=minimal',
                },
                body: JSON.stringify({
                    ...updateData,
                    ai_can_schedule: false,
                    default_meeting_duration: 30,
                    business_hours: {
                        monday: { active: true, start: '09:00', end: '18:00' },
                        tuesday: { active: true, start: '09:00', end: '18:00' },
                        wednesday: { active: true, start: '09:00', end: '18:00' },
                        thursday: { active: true, start: '09:00', end: '18:00' },
                        friday: { active: true, start: '09:00', end: '18:00' },
                        saturday: { active: false, start: '09:00', end: '13:00' },
                        sunday: { active: false, start: '09:00', end: '13:00' },
                    },
                }),
            });

            if (!insertRes.ok) {
                const errText = await insertRes.text();
                console.error('Supabase insert error:', errText);
                return res.redirect(302, `${returnUrl}?google_error=db_error`);
            }
        }

        return res.redirect(302, `${returnUrl}?google_connected=true`);
    } catch (err) {
        console.error('OAuth callback error:', err);
        return res.redirect(302, `${returnUrl}?google_error=server_error`);
    }
}
