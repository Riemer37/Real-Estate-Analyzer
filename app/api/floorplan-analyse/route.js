import Anthropic from '@anthropic-ai/sdk';
import { auth, clerkClient } from '@clerk/nextjs/server';

export const maxDuration = 60;

export async function POST(request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: 'ANTHROPIC_API_KEY niet geconfigureerd' }, { status: 503 });
  }
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Inloggen vereist' }, { status: 401 });
  const clerk = await clerkClient();
  const user  = await clerk.users.getUser(userId);
  if (!user.publicMetadata?.isPro) return Response.json({ error: 'Pro vereist' }, { status: 403 });

  const { base64, mediaType } = await request.json();
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const isImage = mediaType.startsWith('image/');
  const contentBlock = isImage
    ? { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } }
    : { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } };

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: [
        contentBlock,
        {
          type: 'text',
          text: `Analyseer deze plattegrond en geef ALLEEN geldige JSON terug (geen markdown, geen code fences).

JSON schema:
{
  "totaalOppervlak": 150,
  "aantalVerdiepingen": 2,
  "opmerkingen": ["opmerking 1", "opmerking 2"],
  "kamers": [
    {
      "naam": "Woonkamer",
      "huidigGebruik": "wonen",
      "oppervlakte": 35,
      "staat": "matig",
      "bijzonderheden": "dragende muur aan zuidzijde"
    }
  ]
}

Regels:
- staat: uitsluitend "uitstekend", "goed", "matig" of "slecht"
- oppervlakte: getal in m², null indien niet leesbaar
- Vermeld alle zichtbare ruimtes inclusief berging, hal, toilet, etc.
- opmerkingen: knelpunten, dragende muren, smalle doorgangen, vluchtwegen`,
        },
      ],
    }],
  });

  const text = msg.content[0].text;
  try {
    const json = text.match(/\{[\s\S]*\}/)?.[0] ?? text;
    return Response.json(JSON.parse(json));
  } catch {
    return Response.json({ error: 'AI kon plattegrond niet verwerken', raw: text }, { status: 422 });
  }
}
