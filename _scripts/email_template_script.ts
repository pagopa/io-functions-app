/* eslint-disable no-console */
import * as fs from "fs";

const LOCAL_ASSET_REGEX = /\.\.\/assets\//g;
const REMOTE_ASSET_BASE_URL = (version: string): string =>
  `https://raw.githubusercontent.com/pagopa/io-messages-email-templates/${version}/assets/`;

export const generateTemplateForMessage = async (): Promise<void> => {
  const templateName = process.argv[2];
  const templateSourceVersion = process.argv[3];
  const emailApplierTemplatePath = process.argv[4];
  const templateTargetPath = process.argv[5];

  const templatePath = `https://raw.githubusercontent.com/pagopa/io-messages-email-templates/${templateSourceVersion}/${templateName}/index.html`;

  console.log(
    `generating template ${templateName} using version ${templateSourceVersion} and target output ${templateTargetPath} using template applier ${emailApplierTemplatePath}`
  );

  const templateResponse: Response = await fetch(templatePath);
  const templateHtml = await templateResponse.text();

  const templateHtmlWithAbsoluteUrl = templateHtml.replace(
    LOCAL_ASSET_REGEX,
    REMOTE_ASSET_BASE_URL(templateSourceVersion)
  );

  const emailApplierTemplate = fs.readFileSync(
    emailApplierTemplatePath,
    "utf8"
  );

  const content = emailApplierTemplate.replace(
    "{{TEMPLATE}}",
    templateHtmlWithAbsoluteUrl
  );

  fs.writeFileSync(`${templateTargetPath}.ts`, content);
};

void generateTemplateForMessage();
console.log("done");
