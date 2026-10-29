import CharacterCustomizationPanel from '../../components/CharacterCustomizationPanel'

// AdminCharacterCustomization.jsx
//
// Thin wrapper around the shared CharacterCustomizationPanel - see that component for the actual
// 3D preview, slot controls, and save logic. This file only supplies the admin-specific dark
// theme, back link, and header text. Lets the admin test the character customization flow
// directly, without needing a separate student or teacher test account.
function AdminCharacterCustomization() {
    return (
        <CharacterCustomizationPanel
            theme="dark"
            backTo="/admin/dashboard"
            breadcrumbLabel="Vault Templates"
            sectionLabel="ADMIN DASHBOARD"
        />
    )
}

export default AdminCharacterCustomization
