import { createFileRoute } from "@tanstack/react-router"

import { voicemailToneWav } from "@/server/simulator/tone.server"

export const Route = createFileRoute("/api/media/voicemail-tone/wav")({
  server: {
    handlers: {
      GET: () => {
        const tone = voicemailToneWav()
        const body = tone.buffer.slice(
          tone.byteOffset,
          tone.byteOffset + tone.byteLength
        ) as ArrayBuffer

        return new Response(body, {
          headers: {
            "Cache-Control": "public, max-age=31536000, immutable",
            "Content-Type": "audio/wav",
          },
        })
      },
    },
  },
})
