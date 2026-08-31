page 50100 "Candidate List"
{
    Caption = 'Candidates';
    PageType = List;
    ApplicationArea = All;
    UsageCategory = Lists;
    SourceTable = "Candidate";
    CardPageId = "Candidate Card";

    layout
    {
        area(Content)
        {
            repeater(General)
            {
                field("Entry No."; Rec."Entry No.") { ApplicationArea = All; }
                field("Candidate Name"; Rec."Candidate Name") { ApplicationArea = All; }
                field("Email"; Rec."Email") { ApplicationArea = All; }
                field("Phone No."; Rec."Phone No.") { ApplicationArea = All; }
                field("Position Applied For"; Rec."Position Applied For") { ApplicationArea = All; }
                field("Interview Date"; Rec."Interview Date") { ApplicationArea = All; }
                field("Application Date"; Rec."Application Date") { ApplicationArea = All; }
            }
        }
    }
}
