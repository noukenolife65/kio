declare namespace kintone.types {
  interface Task {
    startsAt: kintone.fieldTypes.DateTime;
    taskName: kintone.fieldTypes.SingleLineText;
    endsAt: kintone.fieldTypes.DateTime;
  }
  interface SavedTask extends Task {
    $id: kintone.fieldTypes.Id;
    $revision: kintone.fieldTypes.Revision;
    更新者: kintone.fieldTypes.Modifier;
    作成者: kintone.fieldTypes.Creator;
    レコード番号: kintone.fieldTypes.RecordNumber;
    更新日時: kintone.fieldTypes.UpdatedTime;
    作成日時: kintone.fieldTypes.CreatedTime;
  }
}
