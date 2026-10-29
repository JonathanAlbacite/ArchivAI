import CharacterCustomizationPanel from '../../components/CharacterCustomizationPanel'

// TeacherCharacterCustomization.jsx
//
// Thin wrapper around the shared CharacterCustomizationPanel - see that component for the actual
// 3D preview, slot controls, and save logic. This file only supplies the teacher-specific back link and header text.
// Lets a teacher try out the character customization flow
// themselves, saving to their own account's loadout (never a student's).
function TeacherCharacterCustomization() {
    return (
        <CharacterCustomizationPanel
            backTo="/teacher/dashboard"
            breadcrumbLabel="Rooms"
            sectionLabel="Character"
        />
    )
}

export default TeacherCharacterCustomization
