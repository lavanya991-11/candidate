table 50100 "Candidate"
{
    Caption = 'Candidate';
    DataClassification = CustomerContent;
    LookupPageId = "Candidate List";
    DrillDownPageId = "Candidate List";

    fields
    {
        field(1; "Entry No."; Integer)
        {
            Caption = 'Entry No.';
            AutoIncrement = true;
            Editable = false;
        }
        field(2; "Candidate Name"; Text[100])
        {
            Caption = 'Candidate Name';
            NotBlank = true;
        }
        field(3; "Email"; Text[80])
        {
            Caption = 'Email';
            ExtendedDatatype = EMail;

            trigger OnValidate()
            var
                MailMgt: Codeunit "Mail Management";
            begin
                if "Email" <> '' then
                    MailMgt.CheckValidEmailAddress("Email");
            end;
        }
        field(4; "Phone No."; Text[30])
        {
            Caption = 'Phone No.';
            ExtendedDatatype = PhoneNo;
        }
        field(5; "Education"; Text[250])
        {
            Caption = 'Education';
        }
        field(6; "Experience"; Text[250])
        {
            Caption = 'Experience';
        }
        field(7; "Skills"; Text[250])
        {
            Caption = 'Skills';
        }
        field(8; "Position Applied For"; Text[100])
        {
            Caption = 'Position Applied For';
        }
        field(9; "Interview Date"; Date)
        {
            Caption = 'Interview Date';
        }
        field(10; "Application Date"; Date)
        {
            Caption = 'Application Date';
            Editable = false;
        }
    }

    keys
    {
        key(PK; "Entry No.")
        {
            Clustered = true;
        }
        key(Email; "Email") { }
    }

    fieldgroups
    {
        fieldgroup(DropDown; "Entry No.", "Candidate Name", "Position Applied For") { }
    }

    trigger OnInsert()
    begin
        if "Application Date" = 0D then
            "Application Date" := Today();
    end;
}
