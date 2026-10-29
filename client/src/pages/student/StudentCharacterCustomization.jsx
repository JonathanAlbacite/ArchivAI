import CharacterCustomizationPanel from '../../components/CharacterCustomizationPanel'

// StudentCharacterCustomization.jsx
//
// Thin wrapper around the shared CharacterCustomizationPanel - see that component for the actual
// 3D preview, slot controls, and save logic. This file only supplies the student-specific theme,
// back link, and header text.
function StudentCharacterCustomization() {
    return (
        <CharacterCustomizationPanel
            theme="light"
            backTo="/student/dashboard"
            breadcrumbLabel="My Rooms"
            sectionLabel="THE ARCHIVIST'S REFLECTION"
        />
    )
}

export default StudentCharacterCustomization
