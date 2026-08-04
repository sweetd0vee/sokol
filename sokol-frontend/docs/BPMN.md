# BPMN Diagrams (XML)

Актуально для процессов UI августа 2026. XML ниже импортируется в Camunda Modeler / bpmn.io
(может потребоваться auto-layout). Связанные user stories: [USER_STORIES.md](USER_STORIES.md).

**Замечание:** диаграмма «Change password» отражает UI-процесс; реального API смены пароля нет
(см. [CODE_REVIEW.md](CODE_REVIEW.md)).

This document contains BPMN 2.0 XML snippets that can be imported into any BPMN modeler
(Camunda Modeler, bpmn.io, etc.). Diagrams use simple elements and may rely on
auto-layout when imported.

## Diagram 1: Checks lifecycle

```xml
<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  id="Definitions_ChecksLifecycle"
  targetNamespace="http://sokol.local/bpmn">
  <bpmn:process id="Process_ChecksLifecycle" name="Checks lifecycle" isExecutable="false">
    <bpmn:startEvent id="Start_Create" name="Start"/>
    <bpmn:task id="Task_Create" name="Create check"/>
    <bpmn:task id="Task_Edit" name="Edit details"/>
    <bpmn:exclusiveGateway id="Gateway_Status" name="Update status"/>
    <bpmn:task id="Task_InProgress" name="Status: In progress"/>
    <bpmn:task id="Task_Complete" name="Status: Completed"/>
    <bpmn:endEvent id="End_Done" name="End"/>

    <bpmn:sequenceFlow id="Flow_1" sourceRef="Start_Create" targetRef="Task_Create"/>
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Task_Create" targetRef="Task_Edit"/>
    <bpmn:sequenceFlow id="Flow_3" sourceRef="Task_Edit" targetRef="Gateway_Status"/>
    <bpmn:sequenceFlow id="Flow_4" sourceRef="Gateway_Status" targetRef="Task_InProgress"/>
    <bpmn:sequenceFlow id="Flow_5" sourceRef="Task_InProgress" targetRef="Task_Complete"/>
    <bpmn:sequenceFlow id="Flow_6" sourceRef="Task_Complete" targetRef="End_Done"/>
  </bpmn:process>
</bpmn:definitions>
```

## Diagram 2: Export checks to XLSX

```xml
<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  id="Definitions_ExportChecks"
  targetNamespace="http://sokol.local/bpmn">
  <bpmn:process id="Process_ExportChecks" name="Export checks (XLSX)" isExecutable="false">
    <bpmn:startEvent id="Start_Export" name="Click Export"/>
    <bpmn:task id="Task_BuildRows" name="Build data rows"/>
    <bpmn:task id="Task_ApplyFont" name="Apply Times New Roman 12"/>
    <bpmn:task id="Task_WriteFile" name="Write XLSX file"/>
    <bpmn:endEvent id="End_FileReady" name="File ready"/>

    <bpmn:sequenceFlow id="Flow_E1" sourceRef="Start_Export" targetRef="Task_BuildRows"/>
    <bpmn:sequenceFlow id="Flow_E2" sourceRef="Task_BuildRows" targetRef="Task_ApplyFont"/>
    <bpmn:sequenceFlow id="Flow_E3" sourceRef="Task_ApplyFont" targetRef="Task_WriteFile"/>
    <bpmn:sequenceFlow id="Flow_E4" sourceRef="Task_WriteFile" targetRef="End_FileReady"/>
  </bpmn:process>
</bpmn:definitions>
```

## Diagram 3: Settings list management

```xml
<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  id="Definitions_SettingsLists"
  targetNamespace="http://sokol.local/bpmn">
  <bpmn:process id="Process_SettingsLists" name="Settings list management" isExecutable="false">
    <bpmn:startEvent id="Start_Settings" name="Open Settings"/>
    <bpmn:task id="Task_SelectList" name="Select list"/>
    <bpmn:task id="Task_Search" name="Search items"/>
    <bpmn:exclusiveGateway id="Gateway_Action" name="Choose action"/>
    <bpmn:task id="Task_Add" name="Add item"/>
    <bpmn:task id="Task_Edit" name="Edit item"/>
    <bpmn:task id="Task_Delete" name="Delete item (confirm)"/>
    <bpmn:endEvent id="End_Settings" name="Done"/>

    <bpmn:sequenceFlow id="Flow_S1" sourceRef="Start_Settings" targetRef="Task_SelectList"/>
    <bpmn:sequenceFlow id="Flow_S2" sourceRef="Task_SelectList" targetRef="Task_Search"/>
    <bpmn:sequenceFlow id="Flow_S3" sourceRef="Task_Search" targetRef="Gateway_Action"/>
    <bpmn:sequenceFlow id="Flow_S4" sourceRef="Gateway_Action" targetRef="Task_Add"/>
    <bpmn:sequenceFlow id="Flow_S5" sourceRef="Gateway_Action" targetRef="Task_Edit"/>
    <bpmn:sequenceFlow id="Flow_S6" sourceRef="Gateway_Action" targetRef="Task_Delete"/>
    <bpmn:sequenceFlow id="Flow_S7" sourceRef="Task_Add" targetRef="End_Settings"/>
    <bpmn:sequenceFlow id="Flow_S8" sourceRef="Task_Edit" targetRef="End_Settings"/>
    <bpmn:sequenceFlow id="Flow_S9" sourceRef="Task_Delete" targetRef="End_Settings"/>
  </bpmn:process>
</bpmn:definitions>
```

## Diagram 4: Change password

```xml
<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  id="Definitions_ChangePassword"
  targetNamespace="http://sokol.local/bpmn">
  <bpmn:process id="Process_ChangePassword" name="Change password" isExecutable="false">
    <bpmn:startEvent id="Start_ChangePw" name="Open Change Password"/>
    <bpmn:task id="Task_EnterPw" name="Enter old/new password"/>
    <bpmn:exclusiveGateway id="Gateway_Validate" name="Valid?"/>
    <bpmn:task id="Task_SavePw" name="Save password"/>
    <bpmn:endEvent id="End_PwDone" name="Done"/>
    <bpmn:task id="Task_Error" name="Show error"/>
    <bpmn:endEvent id="End_PwFail" name="Canceled"/>

    <bpmn:sequenceFlow id="Flow_P1" sourceRef="Start_ChangePw" targetRef="Task_EnterPw"/>
    <bpmn:sequenceFlow id="Flow_P2" sourceRef="Task_EnterPw" targetRef="Gateway_Validate"/>
    <bpmn:sequenceFlow id="Flow_P3" sourceRef="Gateway_Validate" targetRef="Task_SavePw"/>
    <bpmn:sequenceFlow id="Flow_P4" sourceRef="Task_SavePw" targetRef="End_PwDone"/>
    <bpmn:sequenceFlow id="Flow_P5" sourceRef="Gateway_Validate" targetRef="Task_Error"/>
    <bpmn:sequenceFlow id="Flow_P6" sourceRef="Task_Error" targetRef="End_PwFail"/>
  </bpmn:process>
</bpmn:definitions>
```
