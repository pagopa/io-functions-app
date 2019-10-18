import { AzureFunction, Context } from "@azure/functions";

import * as request from "superagent";

import { readableReport } from "italia-ts-commons/lib/reporters";

import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";

import { RetrievedProfile } from "io-functions-commons/dist/src/models/profile";

import { NewMessage } from "io-functions-commons/dist/generated/definitions/NewMessage";

// HTTP external requests timeout in milliseconds
const DEFAULT_REQUEST_TIMEOUT_MS = 10000;

// Needed to call notifications API
const publicApiUrl = getRequiredStringEnv("PUBLIC_API_URL");
const publicApiKey = getRequiredStringEnv("PUBLIC_API_KEY");

type WelcomeMessages = ReadonlyArray<(p: RetrievedProfile) => NewMessage>;

// TODO: internal links
// TODO: switch text based on user's preferred_language
const welcomeMessages: WelcomeMessages = [
  (_: RetrievedProfile) =>
    NewMessage.decode({
      content: {
        markdown: `## Benvenuto su IO, l'applicazione dei servizi pubblici, ora in fase beta!

Scopri le funzioni e impara a usare l'app del cittadino.

### I messaggi
IO ti consente di ricevere messaggi dalle Pubbliche Amministrazioni italiane, sia locali che nazionali, e all'occorrenza effettuare pagamenti.
Puoi decidere da chi e come essere contattato, dalla sezione [servizi](ioit://PREFERENCES_SERVICES) di questa applicazione, e scegliere se inoltrare il messaggio anche al tuo indirizzo email associato a SPID.

### I pagamenti

IO si appoggia a pagoPA per effettuare pagamenti verso la Pubblica Amministrazione: se hai già usato pagoPA come utente registrato potrai vedere lo storico delle transazioni ed eventuali carte di credito salvate nella sezione [portafoglio](ioit://WALLET_HOME).
Altrimenti, sempre dal [portafoglio](ioit://WALLET_HOME) puoi aggiungere i tuoi metodi di pagamento preferiti, oppure pagare direttamente un avviso pagoPA leggendo il QR code di un avviso cartaceo.
Quando effettui un pagamento tramite l’app, questa ti informerà del buon esito della transazione (salvo buon fine sul tuo conto) indicandoti accanto al pagamento che questo risulta “pagato”.
L'effettiva chiusura della posizione debitoria ti verrà comunicata dall'ente titolare del servizio, se questo lo prevede.

### Come comunicare con noi e contribuire al progetto

Lo sviluppo ed il miglioramento di IO non si fermerà di certo quest'anno, ma in questa fase di closed beta è importante il contributo di tutti gli utenti per migliorarla.
Se qualcosa non funziona, segnalalo cliccando l'icona della coccinella che trovi in alto a destra nella app.
Se invece vuoi comunicare direttamente col team di sviluppo di IO, puoi usare l'icona della chat sempre in alto a destra.
Se qualcosa non ti dovesse essere chiaro durante l'utilizzo dell'app, clicca il punto di domanda (lo aggiungeremo mano a mano a tutte le schermate che lo richiedono).

Se qualcosa dei messaggi che ricevi non ti è chiaro, puoi andare alla scheda servizio cliccando sul logo dell'ente che ti ha inviato il messaggio, e lì troverai i recapiti dei responsabili del servizio.
IO è un progetto 100% open source: quindi se sei un designer o uno sviluppatore, puoi contribuire direttamente: trovi tutte le informazioni nella [sezione dedicata](https://io.italia.it/sviluppatori/) sul sito del progetto.

Grazie per far parte del progetto IO!`,

        subject: `Benvenuto!`
      }
    }).getOrElseL(errs => {
      throw new Error(
        "Invalid MessageContent for welcome message: " + readableReport(errs)
      );
    }),
  (_: RetrievedProfile) =>
    NewMessage.decode({
      content: {
        markdown: `## Scopri come attivare o disattivare i servizi delle amministrazioni pubbliche.

Scegli i servizi con cui vuoi interagire nell'app.

Al lancio dell'applicazione la lista dei servizi disponibili comprende tutti quelli a livello nazionale (ad esempio l'ACI) e quelli relativi ad alcune regioni e ad alcuni comuni, ma non temere: ti scriveranno solo i servizi che hanno qualcosa di specifico da dire proprio a te! ;-)

Nella sezione [servizi](ioit://PREFERENCES_SERVICES) dentro [preferenze](ioit://PREFERENCES_HOME) puoi scegliere su quale canale ricevere le comunicazioni di ciascun servizio (notifiche, email, ecc.) e puoi anche decidere di disattivare eventuali servizi a cui non sei interessato. In quest'ultimo caso i servizi verranno disattivati da IO: per comunicare con gli enti dovrai utilizzare i canali tradizionali che usavi in precedenza.

L’app IO infatti non sostituisce i mezzi di comunicazione che gli enti usano per comunicare con i cittadini, ma si aggiunge ad essi consentendoti di ricevere i messaggi e conoscere i servizi più agevolmente.
È importante sapere che le comunicazioni inviate tramite IO, per il momento, non hanno valore legale.`,

        subject: `Gestire i servizi in IO`
      }
      // tslint:disable-next-line:no-identical-functions
    }).getOrElseL(errs => {
      throw new Error(
        "Invalid MessageContent for welcome message: " + readableReport(errs)
      );
    })
];

/**
 * Send a single welcome message using the
 * Digital Citizenship Notification API (REST).
 *
 *  TODO: use italia-commons client with retries
 */
async function sendWelcomeMessage(
  url: string,
  apiKey: string,
  newMessage: NewMessage
): Promise<number> {
  const response = await request("POST", url)
    .set("Content-Type", "application/json")
    .set("Ocp-Apim-Subscription-Key", apiKey)
    .timeout(DEFAULT_REQUEST_TIMEOUT_MS)
    .send(newMessage);

  return response.status;
}

/**
 * Send all welcome messages to the user
 * identified by the provided fiscal code.
 */
function sendWelcomeMessages(
  apiUrl: string,
  apiKey: string,
  messages: WelcomeMessages,
  profile: RetrievedProfile
): Promise<ReadonlyArray<number>> {
  const fiscalCode = profile.fiscalCode;

  const url = `${apiUrl}/api/v1/messages/${fiscalCode}`;

  return Promise.all(
    messages.map(welcomeMessage =>
      sendWelcomeMessage(url, apiKey, welcomeMessage(profile))
    )
  );
}

const activityFunction: AzureFunction = async (
  context: Context,
  input: {
    profile: RetrievedProfile;
  }
): Promise<string> => {
  const profileOrError = RetrievedProfile.decode(input.profile);

  if (profileOrError.isLeft()) {
    context.log.error(
      `WelcomeMessageActivity|Cannot decode input profile|ERROR=${readableReport(
        profileOrError.value
      )}|INPUT=${JSON.stringify(input.profile)}`
    );
    return "FAILURE";
  }

  const profile = profileOrError.value;

  const logPrefix = `SendWelcomeMessageActivity|PROFILE=${profile.fiscalCode}|VERSION=${profile.version}`;

  context.log.verbose(`${logPrefix}|Sending welcome messages`);

  const result = await sendWelcomeMessages(
    publicApiUrl,
    publicApiKey,
    welcomeMessages,
    profile
  );

  context.log.verbose(`${logPrefix}|RESPONSES=${result.join(",")}`);

  return "SUCCESS";
};

export default activityFunction;
