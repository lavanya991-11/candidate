page 50101 "Candidate Card"
{
    Caption = 'Candidate';
    PageType = Card;
    ApplicationArea = All;
    SourceTable = "Candidate";

    layout
    {
        area(Content)
        {
            group(General)
            {
                field("Entry No."; Rec."Entry No.") { ApplicationArea = All; }
                field("Candidate Name"; Rec."Candidate Name") { ApplicationArea = All; }
                field("Email"; Rec."Email") { ApplicationArea = All; }
                field("Phone No."; Rec."Phone No.") { ApplicationArea = All; }
                field("Application Date"; Rec."Application Date") { ApplicationArea = All; }
            }
            group(Background)
            {
                Caption = 'Background';
                field("Education"; Rec."Education") { ApplicationArea = All; MultiLine = true; }
                field("Experience"; Rec."Experience") { ApplicationArea = All; MultiLine = true; }
                field("Skills"; Rec."Skills") { ApplicationArea = All; MultiLine = true; }
            }
            group(Recruitment)
            {
                Caption = 'Recruitment';
                field("Position Applied For"; Rec."Position Applied For") { ApplicationArea = All; }
                field("Interview Date"; Rec."Interview Date") { ApplicationArea = All; }
            }
        }
    }
}
