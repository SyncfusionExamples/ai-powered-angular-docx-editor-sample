# AI Powered Angular DOCX Editor
A sample project showcasing the Angular DOCX Editor (Document Editor) with AI assistance for generating, refining, and translating content.


## Introduction


This sample demonstrates document editing with AI-assisted content generation using the Syncfusion<sup style="font-size:70%">&reg;</sup> [Angular DOCX Editor](https://www.syncfusion.com/docx-editor-sdk/angular-docx-editor?utm_source=github&utm_medium=listing&utm_campaign=github-github-documenteditor-examples) (Document Editor) in the client and an ASP.NET Core Web API.


## Features

### AI-Assisted Editing

The AI Assist experience is integrated into the Angular DOCX editor and
communicates with Azure OpenAI through the ASP.NET Core API.

The sample supports:

-   AI content generation.
-   Rephrasing selected content.
-   Grammar improvement.
-   Translation.

The Azure OpenAI API key remains on the server and is not exposed to the
Angular client.

------------------------------------------------------------------------

## Prerequisites

Install the following before running the sample:

1. **.NET 10 SDK**
2. **Node.js and npm**
3. A valid **Syncfusion license key** for the Syncfusion components used by the sample.
4. An **Azure OpenAI** resource with a deployed chat-capable model if the AI features are required.
------------------------------------------------------------------------

## Configuration

### Azure OpenAI Configuration

Azure OpenAI configuration is located in:

``` text
Server-side/src/appsettings.json
```

The repository contains the following configuration section. Configure the chat settings for the AI functionality:

``` json
"AzureOpenAI": {
  "ChatEndpoint": "",
  "ChatApiKey": "",
  "ChatDeploymentName": ""
}
```

------------------------------------------------------------------------

### Web API Base URL

The Angular application gets the ASP.NET Core API URL from:

``` text
Angular/src/app/app.component.ts
```

The default configuration is:

``` typescript
const SERVICE_URL = 'http://localhost:62869/api/DocumentEditor/';
```

If the Web API is deployed to Azure, update `SERVICE_URL`.

For example:

``` typescript
const SERVICE_URL = 'https://your-api.azurewebsites.net/api/DocumentEditor/';
```

------------------------------------------------------------------------

## How to Run the Sample

### 1. Run the ASP.NET Core Web API

Open a terminal in:

``` text
Server-side/src/
```

Restore the NuGet packages:

``` bash
dotnet restore
```

Build the project:

``` bash
dotnet build
```

Run the API:

``` bash
dotnet run
```

The configured project profile uses:

``` text
http://localhost:62870/
```

Keep the API running.

------------------------------------------------------------------------

### 2. Run the Angular Client

Open another terminal in:

``` text
Angular/
```

Install the npm dependencies:

``` bash
npm install
```

Start the Angular development server:

``` bash
npm start
```

Angular CLI will display the client URL in the terminal.

Open the displayed URL in a browser.

------------------------------------------------------------------------

## Resources

- **Product page:**   [Syncfusion Angular DOCX Editor](https://www.syncfusion.com/docx-editor-sdk/angular-docx-editor?utm_source=github&utm_medium=listing&utm_campaign=github-github-documenteditor-examples) 

- **Documentation:**   [Syncfusion Angular DOCX Editor - Documentation](https://help.syncfusion.com/document-processing/word/word-processor/angular/overview?utm_source=github&utm_medium=listing&utm_campaign=github-github-documenteditor-examples) 

- **Online demo:**   [Syncfusion Angular DOCX Editor - Online demo](https://document.syncfusion.com/demos/docx-editor/angular/#/tailwind3/document-editor/default?utm_source=github&utm_medium=listing&utm_campaign=github-github-documenteditor-examples)

## Support and feedback 

For any other queries, reach our [Syncfusion® support team](https://support.syncfusion.com/?utm_source=github&utm_medium=listing&utm_campaign=github-github-documenteditor-examples) or post the queries through the [community forums](https://www.syncfusion.com/forums?utm_source=github&utm_medium=listing&utm_campaign=github-github-documenteditor-examples). 

Request new feature through [Syncfusion® feedback portal](https://www.syncfusion.com/feedback?utm_source=github&utm_medium=listing&utm_campaign=github-github-documenteditor-examples). 

## License

This is a commercial product and requires a paid license for possession or use Syncfusion's licensed software, including this component, is subject to the terms and conditions of [Syncfusion's EULA](https://www.syncfusion.com/license/studio/syncfusion_essential_studio_eula.pdf?utm_source=github&utm_medium=listing&utm_campaign=github-github-documenteditor-examples). You can purchase a licnense [here](https://www.syncfusion.com/sales/products?utm_source=github&utm_medium=listing&utm_campaign=github-github-documenteditor-examples) or start a free 30\-day trial [here](https://www.syncfusion.com/account/manage-trials/start-trials?utm_source=github&utm_medium=listing&utm_campaign=github-github-documenteditor-examples). 