FROM node:10.14.1

WORKDIR /usr/src/app

RUN apt-get update \
    && apt-get install -y apt-transport-https \
    && wget https://packages.microsoft.com/config/ubuntu/19.10/packages-microsoft-prod.deb -O packages-microsoft-prod.deb \
    && dpkg -i packages-microsoft-prod.deb \
    && apt-get update \
    && apt-get install -y dotnet-sdk-3.1 \
    && apt-get install azure-functions-core-tools-3

ENV AzureWebJobsScriptRoot=/usr/src/app \
    AzureFunctionsJobHost__Logging__Console__IsEnabled=true

CMD ["yarn", "start"]
