/**
 * Return the validation email html content
 *
 * @param title
 * @param validationUrl
 */
// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export function getEmailHtmlFromTemplate(
  title: string,
  validationUrl: string
): string {
  return `
<!doctype html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">

<head>
  <title>${title}</title>
  <!--[if !mso]><!-- -->
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <!--<![endif]-->
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style type="text/css">
    #outlook a {
      padding: 0;
    }

    body {
      margin: 0;
      padding: 0;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }

    table,
    td {
      border-collapse: collapse;
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }

    img {
      border: 0;
      height: auto;
      line-height: 100%;
      outline: none;
      text-decoration: none;
      -ms-interpolation-mode: bicubic;
    }

    p {
      display: block;
      margin: 13px 0;
    }
  </style>
  <!--[if mso]>
        <xml>
        <o:OfficeDocumentSettings>
          <o:AllowPNG/>
          <o:PixelsPerInch>96</o:PixelsPerInch>
        </o:OfficeDocumentSettings>
        </xml>
        <![endif]-->
  <!--[if lte mso 11]>
        <style type="text/css">
          .mj-outlook-group-fix { width:100% !important; }
        </style>
        <![endif]-->
  <!--[if !mso]><!-->
  <link href="https://fonts.googleapis.com/css?family=Titillium Web" rel="stylesheet" type="text/css">
  <style type="text/css">
    @import url(https://fonts.googleapis.com/css?family=Titillium Web);
  </style>
  <!--<![endif]-->
  <style type="text/css">
    @media only screen and (min-width:480px) {
      .mj-column-per-100 {
        width: 100% !important;
        max-width: 100%;
      }
    }
  </style>
  <style type="text/css">
    [owa] .mj-column-per-100 {
      width: 100% !important;
      max-width: 100%;
    }
  </style>
  <style type="text/css">
    @media only screen and (max-width:480px) {
      table.mj-full-width-mobile {
        width: 100% !important;
      }

      td.mj-full-width-mobile {
        width: auto !important;
      }
    }
  </style>
</head>

<body style="background-color:#ffffff;">
  <div style="background-color:#ffffff;">
    <!--[if mso | IE]>
      <table
         align="center" border="0" cellpadding="0" cellspacing="0" class="" style="width:600px;" width="600"
      >
        <tr>
          <td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;">
      <![endif]-->
    <div style="margin:0px auto;max-width:600px;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;">
        <tbody>
          <tr>
            <td style="direction:ltr;font-size:0px;padding:20px 0;text-align:center;">
              <!--[if mso | IE]>
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                
        <tr>
      
            <td
               class="" style="vertical-align:top;width:600px;"
            >
          <![endif]-->
              <div class="mj-column-per-100 mj-outlook-group-fix" style="font-size:0px;text-align:left;direction:ltr;display:inline-block;vertical-align:top;width:100%;">
                <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="vertical-align:top;" width="100%">
                  <tr>
                    <td align="center" style="font-size:0px;padding:0px 25px 0px 25px;padding-top:0px;padding-right:25px;padding-bottom:0px;padding-left:25px;word-break:break-word;">
                      <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;border-spacing:0px;">
                        <tbody>
                          <tr>
                            <td style="width:56px;">
                              <img alt="" height="auto" src="https://app-backend.io.italia.it/assets/logo.png" style="border:none;display:block;outline:none;text-decoration:none;height:auto;width:100%;font-size:13px;" title="" width="56" />
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td align="left" style="font-size:0px;padding:0px 25px 0px 25px;padding-top:0px;padding-right:25px;padding-bottom:0px;padding-left:25px;word-break:break-word;">
                      <div style="font-family:Arial, sans-serif;font-size:13px;line-height:24px;text-align:left;color:#000000;">
                        <p style="text-align: center; margin: 10px 0;"><span style="color:#5c6f82;"><span style="font-size:14px;"><span style="font-family:Titillium Web,Helvetica,Arial,sans-serif;">IO, l’app dei servizi pubblici</span></span></span></p>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td align="left" style="font-size:0px;padding:0px 25px 0px 25px;padding-top:0px;padding-right:25px;padding-bottom:0px;padding-left:25px;word-break:break-word;">
                      <div style="font-family:Arial, sans-serif;font-size:13px;line-height:24px;text-align:left;color:#000000;">
                        <p style="margin: 10px 0;">Ciao,<br>per attivare alcune funzioni di IO devi validare la tua email.</p>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td align="left" vertical-align="middle" style="font-size:0px;padding:0px 25px 0px 25px;padding-top:0px;padding-right:25px;padding-bottom:0px;padding-left:25px;word-break:break-word;">
                      <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:separate;line-height:100%;">
                        <tr>
                          <td align="center" bgcolor="#0073E6" role="presentation" style="border:0px solid #ffffff;border-radius:4px;cursor:auto;mso-padding-alt:10px 25px 10px 25px;background:#0073E6;" valign="middle">
                            <a href="${validationUrl}" style="display:inline-block;background:#0073E6;color:#ffffff;font-family:Titillium Web, Helvetica, Arial, sans-serif;font-size:16px;font-weight:normal;line-height:120%;margin:0;text-decoration:none;text-transform:none;padding:10px 25px 10px 25px;mso-padding-alt:0px;border-radius:4px;" target="_blank">
                              <b style="font-weight:700">Valida questo indirizzo email</b>
                            </a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td align="left" style="font-size:0px;padding:10px 25px;padding-top:0px;padding-bottom:0px;word-break:break-word;">
                      <div style="font-family:Arial, sans-serif;font-size:13px;line-height:24px;text-align:left;color:#000000;">
                        <p style="margin: 10px 0;">Oppure copia e incolla nella barra degli indirizzi del tuo browser questo link<br>${validationUrl}<br>A presto,</p>
                        <p style="margin: 10px 0;">Il Team di IO – l’app dei servizi pubblici</p>
                      </div>
                    </td>
                  </tr>
                </table>
              </div>
              <!--[if mso | IE]>
            </td>
          
        </tr>
      
                  </table>
                <![endif]-->
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <!--[if mso | IE]>
          </td>
        </tr>
      </table>
      <![endif]-->
  </div>
</body>

</html>
`;
}
