import type { Scenario, ScenarioEvent, ScenarioLanguage } from "./types"

export type ScenarioLanguageOption = {
  code: ScenarioLanguage
  label: string
  locale: string
  voiceName: string
}

export const scenarioLanguageOptions: ScenarioLanguageOption[] = [
  {
    code: "en",
    label: "English",
    locale: "en-US",
    voiceName: "en-US-JennyNeural",
  },
  {
    code: "es",
    label: "Spanish",
    locale: "es-ES",
    voiceName: "es-ES-ElviraNeural",
  },
  {
    code: "fr",
    label: "French",
    locale: "fr-FR",
    voiceName: "fr-FR-DeniseNeural",
  },
  {
    code: "ar",
    label: "Arabic",
    locale: "ar-SA",
    voiceName: "ar-SA-ZariyahNeural",
  },
  {
    code: "it",
    label: "Italian",
    locale: "it-IT",
    voiceName: "it-IT-ElsaNeural",
  },
  {
    code: "nl",
    label: "Dutch",
    locale: "nl-NL",
    voiceName: "nl-NL-ColetteNeural",
  },
  {
    code: "pt",
    label: "Portuguese",
    locale: "pt-PT",
    voiceName: "pt-PT-RaquelNeural",
  },
  {
    code: "de",
    label: "German",
    locale: "de-DE",
    voiceName: "de-DE-KatjaNeural",
  },
]

const scenarioText: Record<
  ScenarioLanguage,
  Record<"default" | "instant-answer" | "slow-answer" | "voicemail", string[]>
> = {
  en: {
    default: [
      "Hello, this is an automated test customer for Dynamics 365 Contact Center. The call was answered successfully.",
      "I have a moment now. Could you briefly tell me what this is about?",
      "Thank you. I am listening and will stay on the line so the test flow remains realistic.",
      "Yes, that makes sense. I am checking my notes at the same time.",
      "All right. From my side this test call is complete. Goodbye.",
    ],
    "instant-answer": [
      "Hello, thank you for calling. I am available right now.",
      "One moment please, I am moving to a quieter place.",
      "Okay, I can hear you better now. What is this about?",
      "Understood. I will stay on the line while you complete the next step.",
      "Thanks for the information. For this test, the call was answered successfully.",
    ],
    "slow-answer": [
      "Hello, sorry, I answered a little late.",
      "I had to come from another room. I am on the phone now.",
      "Could you please explain that again slowly?",
      "Okay, I understand. I will wait while you check the data in the system.",
      "Thank you, that is enough for my test call. I will hang up shortly.",
    ],
    voicemail: [
      "You have reached the test customer's voicemail.",
      "I cannot take the call personally right now.",
      "Please leave your name, your reason for calling, and a callback number.",
      "This greeting will remain active for a moment so the dialer detects a realistic voicemail window.",
      "Please leave a message after the tone.",
    ],
  },
  es: {
    default: [
      "Hola, soy un cliente de prueba automatizado para Dynamics 365 Contact Center. La llamada se ha contestado correctamente.",
      "Ahora tengo un momento. Puede decirme brevemente de que se trata?",
      "Gracias. Estoy escuchando y permanecere en la linea para que la prueba sea realista.",
      "Si, eso tiene sentido. Estoy revisando mis notas al mismo tiempo.",
      "De acuerdo. Por mi parte, esta llamada de prueba ha terminado. Adios.",
    ],
    "instant-answer": [
      "Hola, gracias por llamar. Ahora estoy disponible.",
      "Un momento, por favor, voy a un lugar mas tranquilo.",
      "Bien, ahora le escucho mejor. De que se trata?",
      "Entendido. Me quedo en la linea mientras completa el siguiente paso.",
      "Gracias por la informacion. Para esta prueba, la llamada se ha contestado correctamente.",
    ],
    "slow-answer": [
      "Hola, disculpe, conteste un poco tarde.",
      "Tuve que venir desde otra habitacion. Ahora estoy al telefono.",
      "Podria explicarlo otra vez despacio, por favor?",
      "Bien, entiendo. Esperare mientras revisa los datos en el sistema.",
      "Gracias, eso es suficiente para mi llamada de prueba. Colgare en breve.",
    ],
    voicemail: [
      "Ha llamado al buzon de voz del cliente de prueba.",
      "No puedo atender la llamada personalmente en este momento.",
      "Por favor, deje su nombre, el motivo de la llamada y un numero para devolverle la llamada.",
      "Este saludo permanecera activo un momento para que el marcador detecte un buzon de voz realista.",
      "Por favor, deje un mensaje despues del tono.",
    ],
  },
  fr: {
    default: [
      "Bonjour, je suis un client de test automatise pour Dynamics 365 Contact Center. L'appel a ete pris avec succes.",
      "J'ai un moment maintenant. Pouvez-vous me dire brievement de quoi il s'agit?",
      "Merci. J'ecoute et je reste en ligne pour que le scenario de test reste realiste.",
      "Oui, c'est clair. Je verifie mes notes en meme temps.",
      "Tres bien. De mon cote, cet appel de test est termine. Au revoir.",
    ],
    "instant-answer": [
      "Bonjour, merci pour votre appel. Je suis disponible maintenant.",
      "Un instant s'il vous plait, je vais dans un endroit plus calme.",
      "Voila, je vous entends mieux maintenant. De quoi s'agit-il?",
      "Compris. Je reste en ligne pendant que vous effectuez l'etape suivante.",
      "Merci pour l'information. Pour ce test, l'appel a ete pris avec succes.",
    ],
    "slow-answer": [
      "Bonjour, desole, j'ai repondu un peu tard.",
      "J'ai du venir d'une autre piece. Je suis maintenant au telephone.",
      "Pouvez-vous expliquer cela encore une fois lentement?",
      "D'accord, je comprends. J'attends pendant que vous verifiez les donnees dans le systeme.",
      "Merci, cela suffit pour mon appel de test. Je vais raccrocher bientot.",
    ],
    voicemail: [
      "Vous etes bien sur la messagerie vocale du client de test.",
      "Je ne peux pas prendre l'appel personnellement pour le moment.",
      "Veuillez laisser votre nom, le motif de votre appel et un numero de rappel.",
      "Cette annonce reste active un instant afin que le composeur detecte une messagerie vocale realiste.",
      "Veuillez laisser un message apres le signal sonore.",
    ],
  },
  ar: {
    default: [
      "مرحبا، هذا عميل اختبار آلي لمركز اتصال Dynamics 365. تم الرد على المكالمة بنجاح.",
      "لدي بعض الوقت الآن. هل يمكنك أن تخبرني باختصار عن سبب الاتصال؟",
      "شكرا لك. أنا أستمع وسأبقى على الخط حتى يبقى مسار الاختبار واقعيا.",
      "نعم، هذا واضح. أراجع ملاحظاتي في الوقت نفسه.",
      "حسنا. من جهتي انتهت مكالمة الاختبار هذه. إلى اللقاء.",
    ],
    "instant-answer": [
      "مرحبا، شكرا لاتصالك. أنا متاح الآن.",
      "لحظة من فضلك، سأنتقل إلى مكان أكثر هدوءا.",
      "حسنا، أستطيع سماعك بشكل أفضل الآن. ما موضوع الاتصال؟",
      "فهمت. سأبقى على الخط بينما تكمل الخطوة التالية.",
      "شكرا على المعلومات. بالنسبة لهذا الاختبار، تم الرد على المكالمة بنجاح.",
    ],
    "slow-answer": [
      "مرحبا، عذرا، لقد أجبت متأخرا قليلا.",
      "كان علي أن آتي من غرفة أخرى. أنا على الهاتف الآن.",
      "هل يمكنك شرح ذلك مرة أخرى ببطء من فضلك؟",
      "حسنا، فهمت. سأنتظر بينما تتحقق من البيانات في النظام.",
      "شكرا، هذا يكفي لمكالمة الاختبار. سأغلق الخط قريبا.",
    ],
    voicemail: [
      "لقد وصلت إلى البريد الصوتي لعميل الاختبار.",
      "لا أستطيع الرد على المكالمة شخصيا في الوقت الحالي.",
      "يرجى ترك اسمك وسبب الاتصال ورقم للاتصال بك مرة أخرى.",
      "ستبقى هذه الرسالة فعالة للحظات حتى يكتشف نظام الاتصال نافذة بريد صوتي واقعية.",
      "يرجى ترك رسالة بعد النغمة.",
    ],
  },
  it: {
    default: [
      "Ciao, sono un cliente di test automatico per Dynamics 365 Contact Center. La chiamata e stata risposta correttamente.",
      "Ho un momento adesso. Puo dirmi brevemente di cosa si tratta?",
      "Grazie. Sto ascoltando e resto in linea per rendere realistico il flusso di test.",
      "Si, ha senso. Sto controllando le mie note allo stesso tempo.",
      "Va bene. Per me questa chiamata di test e conclusa. Arrivederci.",
    ],
    "instant-answer": [
      "Ciao, grazie per la chiamata. Sono disponibile adesso.",
      "Un momento per favore, mi sposto in un posto piu tranquillo.",
      "Bene, ora la sento meglio. Di cosa si tratta?",
      "Capito. Resto in linea mentre completa il passaggio successivo.",
      "Grazie per l'informazione. Per questo test, la chiamata e stata risposta correttamente.",
    ],
    "slow-answer": [
      "Ciao, scusi, ho risposto un po in ritardo.",
      "Dovevo arrivare da un'altra stanza. Ora sono al telefono.",
      "Puo spiegarlo di nuovo lentamente, per favore?",
      "Va bene, capisco. Aspetto mentre controlla i dati nel sistema.",
      "Grazie, e sufficiente per la mia chiamata di test. Riaggancero tra poco.",
    ],
    voicemail: [
      "Ha raggiunto la segreteria telefonica del cliente di test.",
      "Al momento non posso rispondere personalmente alla chiamata.",
      "Lasci il suo nome, il motivo della chiamata e un numero per essere richiamato.",
      "Questo messaggio restera attivo per un momento, cosi il dialer rileva una finestra di segreteria realistica.",
      "Lasci un messaggio dopo il segnale acustico.",
    ],
  },
  nl: {
    default: [
      "Hallo, dit is een automatische testklant voor Dynamics 365 Contact Center. De oproep is succesvol beantwoord.",
      "Ik heb nu even tijd. Kunt u kort vertellen waar het over gaat?",
      "Dank u. Ik luister en blijf aan de lijn zodat de test realistisch blijft.",
      "Ja, dat is duidelijk. Ik controleer tegelijk mijn notities.",
      "Prima. Wat mij betreft is deze testoproep klaar. Tot ziens.",
    ],
    "instant-answer": [
      "Hallo, bedankt voor uw oproep. Ik ben nu bereikbaar.",
      "Een moment alstublieft, ik ga naar een rustigere plek.",
      "Zo, nu kan ik u beter horen. Waar gaat het over?",
      "Begrepen. Ik blijf aan de lijn terwijl u de volgende stap uitvoert.",
      "Bedankt voor de informatie. Voor deze test is de oproep succesvol beantwoord.",
    ],
    "slow-answer": [
      "Hallo, sorry, ik nam iets later op.",
      "Ik moest uit een andere kamer komen. Ik ben nu aan de telefoon.",
      "Kunt u dat nog een keer rustig uitleggen?",
      "Oké, ik begrijp het. Ik wacht terwijl u de gegevens in het systeem controleert.",
      "Dank u, dat is genoeg voor mijn testoproep. Ik hang zo op.",
    ],
    voicemail: [
      "U heeft de voicemail van de testklant bereikt.",
      "Ik kan de oproep op dit moment niet persoonlijk aannemen.",
      "Laat alstublieft uw naam, de reden van uw oproep en een terugbelnummer achter.",
      "Deze begroeting blijft nog even actief zodat de dialer een realistisch voicemailvenster detecteert.",
      "Laat een bericht achter na de toon.",
    ],
  },
  pt: {
    default: [
      "Ola, este e um cliente de teste automatico para o Dynamics 365 Contact Center. A chamada foi atendida com sucesso.",
      "Tenho um momento agora. Pode dizer brevemente do que se trata?",
      "Obrigado. Estou a ouvir e vou manter-me em linha para que o fluxo de teste seja realista.",
      "Sim, faz sentido. Estou a verificar as minhas notas ao mesmo tempo.",
      "Muito bem. Da minha parte, esta chamada de teste esta concluida. Adeus.",
    ],
    "instant-answer": [
      "Ola, obrigado pela chamada. Estou disponivel agora.",
      "Um momento, por favor, vou para um local mais calmo.",
      "Pronto, agora consigo ouvi-lo melhor. Do que se trata?",
      "Compreendido. Vou ficar em linha enquanto conclui o proximo passo.",
      "Obrigado pela informacao. Para este teste, a chamada foi atendida com sucesso.",
    ],
    "slow-answer": [
      "Ola, desculpe, atendi um pouco tarde.",
      "Tive de vir de outra sala. Agora estou ao telefone.",
      "Pode explicar isso novamente devagar, por favor?",
      "Certo, compreendo. Vou aguardar enquanto verifica os dados no sistema.",
      "Obrigado, isto e suficiente para a minha chamada de teste. Vou desligar em breve.",
    ],
    voicemail: [
      "Chegou ao correio de voz do cliente de teste.",
      "Nao posso atender a chamada pessoalmente neste momento.",
      "Por favor, deixe o seu nome, o motivo da chamada e um numero para retorno.",
      "Esta saudacao ficara ativa por um momento para que o marcador detete uma janela de correio de voz realista.",
      "Por favor, deixe uma mensagem depois do sinal.",
    ],
  },
  de: {
    default: [
      "Hallo, dies ist ein automatisierter Testkunde fuer Dynamics 365 Contact Center. Der Anruf wurde erfolgreich angenommen.",
      "Ich habe gerade einen Moment Zeit. Koennen Sie mir kurz sagen, worum es geht?",
      "Danke. Ich hoere zu und bleibe in der Leitung, damit der Testablauf realistisch bleibt.",
      "Ja, das klingt nachvollziehbar. Ich pruefe parallel meine Unterlagen.",
      "Alles klar. Von meiner Seite ist das fuer diesen Test in Ordnung. Auf Wiederhoeren.",
    ],
    "instant-answer": [
      "Hallo, danke fuer Ihren Anruf. Ich bin gerade erreichbar.",
      "Einen Augenblick bitte, ich suche mir kurz einen ruhigen Platz.",
      "So, jetzt kann ich besser sprechen. Worum geht es genau?",
      "Verstanden. Ich bleibe dran und lasse Sie den naechsten Schritt ausfuehren.",
      "Danke fuer die Information. Fuer den Test ist der Anruf damit erfolgreich angenommen.",
    ],
    "slow-answer": [
      "Hallo, entschuldigung, ich habe etwas spaeter abgenommen.",
      "Ich musste erst aus einem anderen Raum kommen. Jetzt bin ich am Telefon.",
      "Koennen Sie das bitte noch einmal langsam erklaeren?",
      "Okay, ich verstehe. Ich warte, waehrend Sie die Daten im System pruefen.",
      "Danke, das reicht fuer meinen Testanruf. Ich lege gleich auf.",
    ],
    voicemail: [
      "Sie haben die Voicemail des Testkunden erreicht.",
      "Ich kann den Anruf gerade nicht persoenlich entgegennehmen.",
      "Bitte sprechen Sie Ihren Namen, Ihr Anliegen und eine Rueckrufnummer auf.",
      "Diese Ansage bleibt noch einen Moment aktiv, damit der Dialer ein realistisches Voicemailfenster erkennt.",
      "Bitte hinterlassen Sie eine Nachricht nach dem Ton.",
    ],
  },
}

const defaultPauses = [8, 9, 10, 8, 10]
const instantPauses = [7, 10, 9, 9, 10]
const slowPauses = [8, 9, 10, 8, 10]
const voicemailPauses = [5, 10, 10, 10, 10]

export function scenarioLanguageOption(
  code: string | null | undefined
): ScenarioLanguageOption {
  return (
    scenarioLanguageOptions.find((option) => option.code === code) ??
    scenarioLanguageOptions.find((option) => option.code === "de") ??
    scenarioLanguageOptions[0]
  )
}

export function inferScenarioLanguage(
  locale: string | null | undefined
): ScenarioLanguage {
  const normalized = locale?.slice(0, 2).toLowerCase()
  return scenarioLanguageOption(normalized).code
}

export function localizedScenarioPreset(
  scenarioName: string,
  language: ScenarioLanguage
): Pick<
  Scenario,
  "language" | "locale" | "voiceName" | "message" | "messages" | "events"
> {
  const option = scenarioLanguageOption(language)
  const templateName = scenarioTemplateName(scenarioName)
  const texts = scenarioText[option.code][templateName]
  const pauses = pausesForTemplate(templateName)
  const events = interleaveEvents(texts, pauses)

  return {
    language: option.code,
    locale: option.locale,
    voiceName: option.voiceName,
    message: texts[0] ?? null,
    messages: texts.map((text, index) => ({
      text,
      pauseAfterSeconds: pauses[index] ?? 0,
    })),
    events,
  }
}

export function scenarioTemplateName(
  scenarioName: string
): "default" | "instant-answer" | "slow-answer" | "voicemail" {
  if (scenarioName === "instant-answer") return "instant-answer"
  if (scenarioName === "slow-answer") return "slow-answer"
  if (scenarioName === "voicemail") return "voicemail"
  return "default"
}

function pausesForTemplate(
  template: "default" | "instant-answer" | "slow-answer" | "voicemail"
) {
  if (template === "instant-answer") return instantPauses
  if (template === "slow-answer") return slowPauses
  if (template === "voicemail") return voicemailPauses
  return defaultPauses
}

function interleaveEvents(texts: string[], pauses: number[]): ScenarioEvent[] {
  return texts.flatMap((text, index) => [
    { type: "tts" as const, text },
    { type: "pause" as const, seconds: pauses[index] ?? 0 },
  ])
}
