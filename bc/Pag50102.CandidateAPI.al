page 50102 "Candidate API"
{
    Caption = 'candidates', Locked = true;
    PageType = API;
    APIPublisher = 'Novasoft';
    APIGroup = 'Novasoft';
    APIVersion = 'v2.0';
    EntityName = 'candidate';
    EntitySetName = 'candidates';
    SourceTable = "Candidate";
    DelayedInsert = true;
    ODataKeyFields = SystemId;
    Extensible = false;

    layout
    {
        area(Content)
        {
            repeater(General)
            {
                field(id; Rec.SystemId) { Editable = false; }
                field(entryNo; Rec."Entry No.") { Editable = false; }
                field(candidateName; Rec."Candidate Name") { }
                field(email; Rec."Email") { }
                field(phoneNo; Rec."Phone No.") { }
                field(education; Rec."Education") { }
                field(experience; Rec."Experience") { }
                field(skills; Rec."Skills") { }
                field(positionAppliedFor; Rec."Position Applied For") { }
                field(interviewDate; Rec."Interview Date") { }
                field(applicationDate; Rec."Application Date") { Editable = false; }
                field(lastModifiedDateTime; Rec.SystemModifiedAt) { Editable = false; }
            }
        }
    }
}
