import CharacterCustomizationPanel from '../../components/CharacterCustomizationPanel'

// AdminCharacterCustomization.jsx
//
// Thin wrapper around the shared CharacterCustomizationPanel - see that component for the actual
// 3D preview, slot controls, and save logic. This file only supplies the admin-specific back link and header text.
// Lets the admin test the character customization flow
// directly, without needing a separate student or teacher test account.
function AdminCharacterCustomization() {
    return (
        <CharacterCustomizationPanel
            backTo="/admin/dashboard"
            breadcrumbLabel="Overview"
            sectionLabel="Character"
        />
    )
}

export default AdminCharacterCustomization
