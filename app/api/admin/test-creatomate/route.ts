import { NextResponse } from 'next/server'

export async function GET() {
  const apiKey = process.env.CREATOMATE_API_KEY
  const templateId = process.env.CREATOMATE_TEMPLATE_ID

  console.log('[test-creatomate] API key present:', !!apiKey)
  console.log('[test-creatomate] Template ID:', templateId)

  if (!apiKey || !templateId) {
    return NextResponse.json({
      error: 'Missing env vars',
      hasApiKey: !!apiKey,
      hasTemplateId: !!templateId
    }, { status: 400 })
  }

  try {
    console.log('[test-creatomate] Sending render request...')
    const response = await fetch('https://api.creatomate.com/v2/renders', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        template_id: templateId,
        modifications: {
          'Video.source': 'https://yuqhvccmbaebxhlexddj.supabase.co/storage/v1/object/public/post-media/42fb4b86-a4f4-49fb-b8ee-2f30b948b970/d44003f3-b814-453c-a92b-3c199f8f8cab/video-1781541977374.mp4',
          'Text-1.text': 'Your weekend sorted. Fresh food, good vibes.',
          'Text-2.text': 'Bites Cafe'
        }
      })
    })

    console.log('[test-creatomate] Response status:', response.status)
    const data = await response.json()
    console.log('[test-creatomate] Response:', JSON.stringify(data))

    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('[test-creatomate] Error:', err)
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
