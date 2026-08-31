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
        field(11; "Title"; Text[10])
        {
            Caption = 'Title';
        }
        field(12; "First Name"; Text[50])
        {
            Caption = 'First Name';
        }
        field(13; "Middle Name"; Text[50])
        {
            Caption = 'Middle Name';
        }
        field(14; "Last Name"; Text[50])
        {
            Caption = 'Last Name';
        }
        field(15; "Date of Birth"; Date)
        {
            Caption = 'Date of Birth';
        }
        field(16; "Gender"; Text[20])
        {
            Caption = 'Gender';
        }
        field(17; "Marital Status"; Text[20])
        {
            Caption = 'Marital Status';
        }
        field(18; "Current Address"; Text[250])
        {
            Caption = 'Current Address';
        }
        field(19; "Permanent Address"; Text[250])
        {
            Caption = 'Permanent Address';
        }
        field(20; "English Certification"; Text[10])
        {
            Caption = 'English Certification';
        }
        field(21; "English Test Date"; Date)
        {
            Caption = 'English Test Date';
        }
        field(22; "Employment History"; Text[1000])
        {
            Caption = 'Employment History';
        }
        field(23; "Reference List"; Text[1000])
        {
            Caption = 'Reference List';
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
