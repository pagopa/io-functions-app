/* eslint-disable no-console */
import * as fs from "fs";

import * as t from "io-ts";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";

import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";

const Parameters = t.type({
  emailApplierTemplatePath: NonEmptyString,
  templateName: NonEmptyString,
  templateSourceVersion: NonEmptyString,
  templateTargetPath: NonEmptyString
});

const LOCAL_ASSET_REGEX = /\.\.\/assets\//g;
const REMOTE_ASSET_BASE_URL = (version: string): string =>
  `https://raw.githubusercontent.com/pagopa/io-messages-email-templates/${version}/assets/`;

export const generateTemplateForMessage = async (): Promise<void> => {
  const params = pipe(
    {
      emailApplierTemplatePath: process.env.APPLIER_TEMPLATE_PATH,
      templateName: process.env.TEMPLATE_NAME,
      templateSourceVersion: process.env.TEMPLATE_VERSION,
      templateTargetPath: process.env.TARGET_PATH
    },
    Parameters.decode,
    E.getOrElseW(() => {
      throw new Error("Error decoding input params");
    })
  );

  const templatePath = `https://raw.githubusercontent.com/pagopa/io-messages-email-templates/${params.templateSourceVersion}/${params.templateName}/index.html`;

  console.log(
    `generating template ${params.templateName} using version ${params.templateSourceVersion} and target output ${params.templateTargetPath} using template applier ${params.emailApplierTemplatePath}`
  );

  const templateResponse: Response = await fetch(templatePath);
  const templateHtml = await templateResponse.text();

  const templateHtmlWithAbsoluteUrl = templateHtml.replace(
    LOCAL_ASSET_REGEX,
    REMOTE_ASSET_BASE_URL(params.templateSourceVersion)
  );

  const emailApplierTemplate = fs.readFileSync(
    params.emailApplierTemplatePath,
    "utf8"
  );

  const content = emailApplierTemplate.replace(
    "{{TEMPLATE}}",
    templateHtmlWithAbsoluteUrl
  );

  fs.writeFileSync(`${params.templateTargetPath}.ts`, content);
};

void generateTemplateForMessage();
console.log("done");
