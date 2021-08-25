import { AzureFunction, Context } from "@azure/functions";

import { toString } from "fp-ts/lib/function";
import * as t from "io-ts";

import { NewMessage } from "@pagopa/io-functions-commons/dist/generated/definitions/NewMessage";
import { RetrievedProfile } from "@pagopa/io-functions-commons/dist/src/models/profile";
import { readableReport } from "@pagopa/ts-commons/lib/reporters";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";

function throwInvalidMessageError(errs: t.Errors): never {
  throw new Error(
    "Invalid MessageContent for welcome message: " + readableReport(errs)
  );
}

export const WelcomeMessageKind = t.keyof({
  CASHBACK: null,
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
        markdown: `Ciao! IO consente agli enti pubblici di portare progressivamente i propri servizi di comunicazione, pagamento, welfare o documentazione in un'unica app, e ai cittadini italiani di avere dei servizi pubblici nuovi, moderni e centrati sulle proprie esigenze e di interagire con le Pubbliche Amministrazioni in modo sicuro e sempre a portata di mano. 

#### Le funzioni di IO
Ecco come potrai usare IO attraverso le diverse funzioni disponibili oggi nell’app:   

#### I messaggi
IO ti consente di ricevere comunicazioni da tutte le Pubbliche Amministrazioni italiane, locali e nazionali, di tenere sotto controllo ogni scadenza e, all’occorrenza, effettuare dei pagamenti. 
All’arrivo di ogni nuovo messaggio, a seconda delle tue preferenze, IO può informarti attraverso una notifica e inoltrarti il messaggio sulla tua casella di posta: nel dettaglio dei servizi, o nelle preferenze presenti nel Profilo, puoi decidere come ricevere comunicazioni da ciascun servizio. 

#### I pagamenti
IO integra [pagoPA](https://www.pagopa.gov.it/) per effettuare pagamenti sicuri verso la Pubblica Amministrazione. Dalla sezione Portafoglio puoi aggiungere i tuoi metodi di pagamento preferiti, procedere al pagamento di un avviso pagoPA (tramite scansione del codice QR o inserimento manuale del codice avviso) e tenere traccia di tutte le operazioni svolte. Se hai già usato pagoPA con SPID in passato, nella sezione Portafoglio potrai vedere lo storico delle transazioni effettuate e i tuoi metodi di pagamento salvati. 

#### I servizi
Al primo accesso in IO, IO ti chiede di impostare una configurazione generale per la comunicazione dei servizi. Nella sezione Servizi puoi vedere la lista di tutti i servizi locali e nazionali disponibili all’interno dell’app, e decidere da quali ricevere comunicazioni e come. 

#### Serve aiuto?
Se qualcosa non ti è chiaro durante l’utilizzo dell’app, usa il punto di domanda in alto a destra per leggere approfondimenti e indicazioni utili relative alla schermata in cui ti trovi.
Ricorda che i messaggi che IO ti recapita sono inviati direttamente dagli enti pubblici: se i tuoi dubbi riguardano il contenuto di un messaggio, segnalalo direttamente all’ente che ti ha scritto; trovi i contatti nel corpo del messaggio o nella scheda del servizio. 
Se hai un problema e non trovi risposte utili nella pagina di aiuto, contatta il team di IO utilizzando il pulsante con la coccinella “Scrivi al team di IO”.

#### Come partecipare al progetto
IO è un progetto che cresce e migliora giorno dopo giorno grazie al contributo degli utenti. Per questo ti chiediamo, se vorrai, di segnalarci eventuali feedback, richieste di migliorie o di nuove funzionalità. 
IO è un progetto open source. Se ti occupi di design o sviluppo, puoi contribuire direttamente: visita il sito [io.italia.it](https://io.italia.it) per maggiori informazioni.

Grazie di far parte del progetto IO!
`,

        subject: `Ti diamo il benvenuto in IO`
      }
    }).getOrElseL(throwInvalidMessageError),
  // tslint:disable-next-line: object-literal-sort-keys
  HOWTO: (_: RetrievedProfile) =>
    NewMessage.decode({
      content: {
        markdown: `L’app IO nasce per offrirti un unico punto di accesso, comodo, semplice e sicuro, verso tutti i servizi della Pubblica Amministrazione.

Oltre 13.000 tra enti nazionali e locali hanno già portato a bordo i loro servizi – relativi, ad esempio, ad anagrafe, scuola, tributi, mobilità, attività produttive, edilizia e sanità – e molti se ne aggiungeranno in futuro: visualizza l’elenco completo di quelli disponibili nella sezione **[Servizi](ioit://SERVICES_HOME)**.

Se non vedi gli enti del tuo territorio tra quelli elencati, è perché i loro servizi sono in corso di integrazione o arriveranno prossimamente.
Puoi decidere tu quali servizi possono contattarti, ma ti consigliamo di lasciare la comunicazione sempre accesa (impostando la configurazione rapida nelle preferenze) perché un servizio ti scriverà solo quando avrà qualcosa di importante da dire proprio a te!  Ad esempio: per la scadenza di un documento, il promemoria per un pagamento o l’aggiornamento su una pratica in corso.

Utilizzando la configurazione manuale dovrai attivare uno a uno i servizi che ti interessano. Nelle preferenze potrai anche decidere di attivare la funzione di inoltro dei messaggi che riceverai su IO, anche al tuo indirizzo e-mail. 

Infine, è importante sapere che per ora i messaggi inviati dagli enti tramite IO non hanno valore legale.

Per maggiori informazioni sull’avanzamento del progetto, visita il sito [io.italia.it](https://io.italia.it).
`,
        subject: `Quali servizi trovi su IO?`
      }
    }).getOrElseL(throwInvalidMessageError),
  CASHBACK: (_: RetrievedProfile) =>
    NewMessage.decode({
      content: {
        markdown: `---
it:
  cta_1:
    text: "Attiva il cashback"
    action: "ioit://CTA_START_BPD"
en:
  cta_1:
    text: "Request cashback"
    action: "ioit://CTA_START_BPD"
---
Aderisci al “Cashback” tramite la sezione **Portafoglio** dell’app IO: puoi ottenere un rimborso sugli acquisti effettuati con carte, bancomat e app di pagamento. Il “Cashback” è una delle iniziative del Piano Italia Cashless promosso dal Governo allo scopo di incentivare un maggiore utilizzo di moneta elettronica nel Paese.

#### Chi può richiederlo?
Se hai compiuto i 18 anni e risiedi in Italia, puoi ottenere un **rimborso in denaro** a fronte di acquisti personali e non per uso professionale con i tuoi **metodi di pagamento elettronici** presso **punti vendita fisici** (non online) situati sul territorio nazionale.

#### Come funziona il Cashback?
1. Il programma Cashback si divide in periodi di durata variabile. Il primo periodo **sperimentale** detto **“Extra Cashback di Natale”**, dura **dall'8 al 31 dicembre 2020.** I successivi dureranno 6 mesi ciascuno, a partire dal 1° gennaio 2021.
2. Per ogni periodo potrai ottenere un **rimborso massimo di €150**. Ogni acquisto effettuato con strumenti di pagamento elettronici **registrati** ai fini dell’iniziativa, ti farà accumulare il 10% dell’importo speso, fino ad un massimo di €15 per transazione.
3. Il cashback accumulato ti verrà rimborsato solo se avrai raggiunto il numero minimo di transazioni valide: **10 nel periodo sperimentale**, 50 in ciascuno dei semestri successivi.
4. Oltre al Cashback, **ma solo a partire dal 1° gennaio 2021**, **i primi 100mila** partecipanti che in ogni semestre hanno totalizzato il **maggior numero di transazioni valide**, ricevono un **Super Cashback di €1500**.
5. Al termine del periodo, ricevi il rimborso complessivo accumulato **sull’IBAN che indicherai durante l’attivazione.**

#### Come si aggiungono i metodi di pagamento?
Aggiungi subito i metodi **a te intestati** nella sezione [Portafoglio](ioit://WALLET_HOME), e abilitali al cashback quando richiesto. Ad oggi sono supportate carte di debito, credito, prepagate e PagoBANCOMAT. Stiamo lavorando per supportare altri metodi in futuro, come Bancomat Pay e Satispay. 

#### Come si aggiunge l'IBAN per ricevere il rimborso previsto?
Attiva il Cashback e inserisci l’IBAN quando richiesto. Puoi inserirlo anche in un secondo momento, ma ricordati di farlo entro il termine del periodo per avere diritto al rimborso.

Per poter attivare il Cashback, devi avere aggiornato IO all'ultima versione disponibile. Scaricala adesso!

[App Store](https://apps.apple.com/it/app/io/id1501681835)

[Play Store](https://play.google.com/store/apps/details?id=it.pagopa.io.app)
`,
        subject: `Attiva il Cashback!`
      }
    }).getOrElseL(throwInvalidMessageError)
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
