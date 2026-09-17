import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { AppComponent } from './app.component';
import { AIPopupComponent } from './components/aipopup/aipopup.component';

import { DocumentEditorContainerModule } from '@syncfusion/ej2-angular-documenteditor';
import { DocumentEditorContainer, Ribbon } from '@syncfusion/ej2-documenteditor';
import { UploaderModule } from '@syncfusion/ej2-angular-inputs';
import { ButtonModule } from '@syncfusion/ej2-angular-buttons';
import { AIAssistViewModule } from '@syncfusion/ej2-angular-interactive-chat';

DocumentEditorContainer.Inject(Ribbon);

@NgModule({
  imports: [
    BrowserModule,
    FormsModule,
    DocumentEditorContainerModule,
    UploaderModule,
    ButtonModule,
    AIAssistViewModule
  ],
  declarations: [AppComponent, AIPopupComponent],
  bootstrap: [AppComponent]
})
export class AppModule {}
