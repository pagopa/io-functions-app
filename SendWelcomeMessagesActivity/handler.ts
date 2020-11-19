import { AzureFunction, Context } from "@azure/functions";
import { toString } from "fp-ts/lib/function";
import { NewMessage } from "io-functions-commons/dist/generated/definitions/NewMessage";
import { RetrievedProfile } from "io-functions-commons/dist/src/models/profile";
import * as t from "io-ts";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { NonEmptyString } from "italia-ts-commons/lib/strings";

export const WelcomeMessageKind = t.keyof({
  HOWTO: null,
  WELCOME: null
});
export type WelcomeMessageKind = t.TypeOf<typeof WelcomeMessageKind>;

type WelcomeMessages = Record<
  WelcomeMessageKind,
  (p: RetrievedProfile) => NewMessage
>;

// TODO: switch text based on user's preferred_language
const welcomeMessages: WelcomeMessages = {
  WELCOME: (_: RetrievedProfile) =>
    NewMessage.decode({
      content: {
        markdown: `## Benvenuto nella prima versione pubblica di IO!

Ciao! Questa è la prima versione di IO, l’app dei servizi pubblici, aperta a tutti i cittadini. Cosa vuol dire? Significa che, come te, chiunque lo desideri potrà installare e iniziare a usare l’app, sapendo che evolverà e migliorerà continuamente anche grazie all’esperienza diretta e ai feedback delle persone a cui è destinata.

Rendendo IO disponibile per tutti, consentiamo agli enti pubblici di portare progressivamente i propri servizi sull’app e ai cittadini italiani di avere dei servizi pubblici nuovi, moderni e centrati sulle proprie esigenze.

### Scopri le funzioni di IO

Ecco come potrai usare IO attraverso le diverse funzioni disponibili oggi nell’app: molte altre ne arriveranno nei prossimi mesi!  
IO ti permetterà di richiedere e spendere il “[Bonus Vacanze](https://io.italia.it/bonus-vacanze/)” e di partecipare al Bonus Cashback, che troverai nella sezione “Portafoglio” dell’app a partire dal 1° dicembre 2020. IO ti avviserà con un aggiornamento quando il nuovo servizio sarà disponibile.

#### I messaggi

IO ti consente di ricevere comunicazioni da tutte le Pubbliche Amministrazioni italiane, locali e nazionali, di tenere sotto controllo ogni scadenza e, all’occorrenza, effettuare dei pagamenti.
All’arrivo di ogni nuovo messaggio, IO ti informa attraverso una notifica e un inoltro del messaggio sulla tua casella di posta: nella sezione [servizi](ioit://SERVICES_HOME) puoi decidere come essere contattato da ciascun servizio.

#### I pagamenti

IO integra [pagoPA](https://www.pagopa.gov.it/) per effettuare pagamenti sicuri verso la Pubblica Amministrazione. Se hai già usato pagoPA come utente registrato, nella sezione [Portafoglio](ioit://WALLET_HOME) potrai vedere lo storico delle transazioni effettuate e le tue carte di credito salvate. Puoi usare la sezione [Portafoglio](ioit://WALLET_HOME) per aggiungere i tuoi metodi di pagamento preferiti, procedere al pagamento di un avviso pagoPA (tramite scansione del codice QR o inserimento manuale del codice IUV) e tenere traccia di tutte le operazioni svolte.
Nella sezione [Portafoglio](ioit://WALLET_HOME) troverai la possibilità di richiedere il [Bonus Vacanze](https://io.italia.it/bonus-vacanze/) e il Bonus Cashback, disponibile a partire dal 1° dicembre.

#### I servizi

Al momento del tuo primo accesso in IO, tutti i Servizi disponibili sono attivi. Nella sezione [servizi](ioit://SERVICES_HOME) puoi vedere quali sono i servizi locali e nazionali disponibili all’interno dell’app, e decidere da quali essere contattato e come. Aggiungi le tue aree geografiche di interesse per essere sempre informato sui nuovi servizi in arrivo nel tuo Comune o nella tua Regione.

#### Serve aiuto ?

Se qualcosa non ti è chiaro durante l’utilizzo dell’app, usa il punto di domanda in alto a destra per leggere approfondimenti e indicazioni utili relative alla sezione in cui ti trovi.
Ricorda che i messaggi che IO ti recapita sono inviati direttamente dagli enti pubblici: se i tuoi dubbi riguardano il contenuto di un messaggio, contatta direttamente l’ente che ti ha scritto con gli appositi pulsanti che trovi nel corpo del messaggio o nella scheda del servizio.
Se hai un problema e non trovi risposte utili nella pagina di aiuto, contatta il team di IO utilizzando il pulsante con la coccinella (se ti sembra si tratti di un malfunzionamento) o l’icona della chat (per interagire direttamente con la nostra assistenza, in caso di problemi urgenti).

#### Come partecipare al progetto

IO è un progetto che cresce e migliora giorno dopo giorno grazie al contributo degli utenti. Per questo ti chiediamo, se vorrai, di segnalarci ogni aspetto dal tuo punto di vista migliorabile, cliccando sul bottone Scrivi al Team di IO con l’icona a coccinella (per segnalare errori di funzionamento) o la chat (per inviare suggerimenti o commentare la tua esperienza).

IO è un progetto 100% open source. Se sei un designer o uno sviluppatore, puoi contribuire direttamente al design e sviluppo dell’applicazione: visita il sito [io.italia.it](https://io.italia.it) per trovare più informazioni su come dare il tuo contributo.

Grazie di far parte del progetto IO!
`,

        subject: `Benvenuto su IO`
      }
    }).getOrElseL(errs => {
      throw new Error(
        "Invalid MessageContent for welcome message: " + readableReport(errs)
      );
    }),
  // tslint:disable-next-line: object-literal-sort-keys
  HOWTO: (_: RetrievedProfile) =>
    NewMessage.decode({
      content: {
        markdown: `## Scopri quali enti e servizi puoi trovare all’interno di IO.

L’app IO nasce per offrirti un unico punto di accesso, comodo, semplice e sicuro, verso tutti i servizi della Pubblica Amministrazione. Diversi enti nazionali e locali hanno già portato i loro servizi a bordo e molti se ne aggiungeranno in futuro. Siamo infatti solo all’inizio del percorso che, progressivamente, porterà i cittadini italiani ad avere nuovi servizi digitali messi a disposizione da tutti gli enti pubblici all’interno dell’app.

Nella sezione [servizi](ioit://SERVICES_HOME) puoi indicare le aree geografiche di tuo interesse (dove vivi, dove lavori, o dove magari vai spesso) per essere sempre informato sui nuovi servizi in arrivo in quel Comune o in quella Regione.

Se non vedi gli enti del tuo territorio tra quelli elencati, è perché i loro servizi sono ancora in corso di integrazione. Se vuoi saperne di più, chiedi al tuo Comune se hanno attivato il processo per essere presenti su IO e a che punto sono. La tua voce può essere un segnale importante!

Tutti i servizi all’interno dell’app sono attivi: questo non vuol dire che ti contatteranno, anzi. Ti scriveranno solo i servizi che hanno qualcosa da dire proprio a te, in caso di comunicazioni rilevanti come ad esempio la scadenza di un documento, il promemoria per un pagamento o l’aggiornamento su una pratica in corso.
Se, per un determinato servizio, preferisci utilizzare mezzi di comunicazione diversi dall’app IO, puoi in ogni momento disattivarlo: in quel caso, l’Ente continuerà a contattarti avvalendosi dei canali tradizionali (come ad esempio la posta cartacea).
In particolare:
- nella sezione [Servizi](ioit://SERVICES_HOME) ti viene data la possibilità di disattivare tutti i servizi, disattivare tutti i servizi per un singolo Ente, oppure disattivare singoli servizi. Inoltre cliccando su ciascun servizio e entrando nella relativa scheda, potrai disattivare le notifiche via email e/o push (che possono essere disabilitate anche tramite la funzionalità del tuo dispositivo);
- nella Sezione [Preferenze](ioit://PROFILE_PREFERENCES_HOME) troverai la funzione "Inoltro dei messaggi via email" dove potrai abilitare/disabilitare tale modalità di notifica per tutti o singoli servizi.

Infine, è importante sapere che per ora i messaggi inviati dagli enti tramite IO non hanno valore legale.

Per approfondimenti ti invitiamo a consultare la sezione [servizi](ioit://SERVICES_HOME) di questa applicazione; per maggiori informazioni sull’avanzamento del progetto, visita il sito [io.italia.it](https://io.italia.it).
`,
        subject: `Quali servizi trovi su IO?`
      }
      // tslint:disable-next-line:no-identical-functions
    }).getOrElseL(errs => {
      throw new Error(
        "Invalid MessageContent for welcome message: " + readableReport(errs)
      );
    })
};

/**
 * Send a single welcome message using the
 * Digital Citizenship Notification API (REST).
 */
async function sendMessage(
  profile: RetrievedProfile,
  apiUrl: string,
  apiKey: string,
  newMessage: NewMessage,
  timeoutFetch: typeof fetch
): Promise<number> {
  const response = await timeoutFetch(
    `${apiUrl}/api/v1/messages/${profile.fiscalCode}`,
    {
      body: JSON.stringify(newMessage),
      headers: {
        "Content-Type": "application/json",
        "Ocp-Apim-Subscription-Key": apiKey
      },
      method: "POST"
    }
  );
  return response.status;
}

// Activity result
const ActivityResultSuccess = t.interface({
  kind: t.literal("SUCCESS")
});

type ActivityResultSuccess = t.TypeOf<typeof ActivityResultSuccess>;

const ActivityResultFailure = t.interface({
  kind: t.literal("FAILURE"),
  reason: t.string
});

type ActivityResultFailure = t.TypeOf<typeof ActivityResultFailure>;

export const ActivityResult = t.taggedUnion("kind", [
  ActivityResultSuccess,
  ActivityResultFailure
]);
export type ActivityResult = t.TypeOf<typeof ActivityResult>;

export const ActivityInput = t.interface({
  messageKind: WelcomeMessageKind,
  profile: RetrievedProfile
});
export type ActivityInput = t.TypeOf<typeof ActivityInput>;

export const getActivityFunction = (
  publicApiUrl: NonEmptyString,
  publicApiKey: NonEmptyString,
  timeoutFetch: typeof fetch
): AzureFunction => async (
  context: Context,
  input: ActivityInput
): Promise<ActivityResult> => {
  const failure = (reason: string) => {
    context.log.error(reason);
    return ActivityResultFailure.encode({
      kind: "FAILURE",
      reason
    });
  };

  const success = () =>
    ActivityResultSuccess.encode({
      kind: "SUCCESS"
    });

  return ActivityInput.decode(input).fold<Promise<ActivityResult>>(
    async errs =>
      failure(
        `SendWelcomeMessagesActivity|Cannot decode input profile|ERROR=${readableReport(
          errs
        )}|INPUT=${JSON.stringify(input.profile)}`
      ),
    async ({ profile, messageKind }) => {
      const logPrefix = `SendWelcomeMessagesActivity|PROFILE=${profile.fiscalCode}|VERSION=${profile.version}`;
      context.log.verbose(`${logPrefix}|Sending welcome message`);

      try {
        const status = await sendMessage(
          profile,
          publicApiUrl,
          publicApiKey,
          welcomeMessages[messageKind](profile),
          timeoutFetch
        );
        if (status !== 201) {
          if (status >= 500) {
            throw new Error(`${status}`);
          } else {
            return failure(`${logPrefix}|HTTP_ERROR=${status}`);
          }
        }
      } catch (e) {
        context.log.error(
          `${logPrefix}|ERROR=${toString(e)}|ID=${profile.fiscalCode.substr(
            0,
            5
          )}`
        );
        // throws in case of error or timeout so
        // the orchestrator can schedule a retry
        throw e;
      }

      return success();
    }
  );
};

export default getActivityFunction;
