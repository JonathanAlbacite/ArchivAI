import CharacterCustomizationPanel from '../../components/CharacterCustomizationPanel'

// StudentCharacterCustomization.jsx
//
// Thin wrapper around the shared CharacterCustomizationPanel - see that component for the actual
// 3D preview, slot controls, and save logic. This file only supplies the student-specific
// back link and header text.
function StudentCharacterCustomization() {
    return (
        <CharacterCustomizationPanel
            backTo="/student/dashboard"
            breadcrumbLabel="Dashboard"
            sectionLabel="Character"
        />
    )
}

export default StudentCharacterCustomization
