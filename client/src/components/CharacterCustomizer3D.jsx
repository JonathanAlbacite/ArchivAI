import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

// CharacterCustomizer3D.jsx
//
// Renders the character preview directly in the browser with three.js - no Unity build involved
// at all for this feature anymore (see StudentCharacterCustomization.jsx for why this replaced the
// embedded Unity WebGL scene).
//
// CATALOG IS NOW ADMIN-MANAGED, NOT HARDCODED HERE - `characterSets` is the GET /api/character-sets
// response (see server/routes/characterSets.js), fetched by the parent page and passed straight
// through as a prop. Each entry is one admin-uploaded .glb plus its slot/meshName/optionId
// mappings - this component no longer has any built-in notion of "base"/"pirate"/"woman"; it just
// loads whatever list it's handed and matches `selections` (a {slot: optionId} map, same shape as
// always) against each set's own slot mappings.
//
// HOW PART-SWAPPING STILL WORKS - every character set is a full rig sharing an identical skeleton
// (same bone names - root, spine_1, legUp.L, etc), so there's no need to re-bind geometry onto a
// shared skeleton: every set in `characterSets` is loaded and kept in the scene the whole time,
// each already correctly driving its own meshes, and this component just toggles .visible on
// exactly one mesh per slot based on which set's optionId is currently selected for that slot.
//
// EVERY MESH STARTS HIDDEN, ONLY THE MAPPED ONES GET SHOWN - an admin-uploaded .glb can contain
// more geometry than just its 4 mapped Head/Body/Arm/Leg nodes (e.g. a new character built by
// duplicating an existing one in Blender, where the original's parts were never deleted before
// export). Only toggling the 4 mapped nodes and leaving everything else at the file's own default
// visibility (almost always visible) let that kind of leftover geometry render forever, underneath
// whatever part actually is mapped - looking like the old model's part never went away. Hiding
// every mesh by default and only re-showing the ones matched to a slot closes that off regardless
// of what else a given .glb happens to contain.
//
// Models are fetched from the SERVER (not a Vite-served /models/ path), since an admin-uploaded
// file lives under server/uploads/character-sets/ - see index.js's static mount for that path.

const API_ORIGIN = import.meta.env.VITE_API_URL

const SLOT_NAMES = ['Head', 'Body', 'Arm', 'Leg']

function CharacterCustomizer3D({ characterSets, selections }) {
    const containerRef = useRef(null)
    const meshesRef = useRef({}) // { [characterSetId]: { Head, Body, Arm, Leg } } - filled in as each set loads
    const selectionsRef = useRef(selections)
    const characterSetsRef = useRef(characterSets)
    const applyVisibilityRef = useRef(() => {})

    selectionsRef.current = selections
    characterSetsRef.current = characterSets

    // Builds the scene once on mount - loading, lighting, the render loop, and drag-to-rotate all
    // live here and are never recreated. `characterSets` is only read through the ref above (same
    // as `selections` already was), since the parent only ever mounts this component once its
    // catalog fetch has finished - see StudentCharacterCustomization.jsx's own loading gate.
    useEffect(() => {
        const container = containerRef.current
        let disposed = false

        const scene = new THREE.Scene()
        // No scene.background set - the canvas stays transparent (see the renderer's alpha +
        // clearColor below) so the page's own background shows through instead of a boxed-in
        // color behind the character.

        const camera = new THREE.PerspectiveCamera(35, container.clientWidth / container.clientHeight, 0.1, 100)
        camera.position.set(0, 1.4, 3.2)
        camera.lookAt(0, 1.0, 0)

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
        renderer.setClearColor(0x000000, 0)
        renderer.setPixelRatio(window.devicePixelRatio)
        renderer.setSize(container.clientWidth, container.clientHeight)
        container.appendChild(renderer.domElement)

        scene.add(new THREE.AmbientLight(0xffffff, 0.7))
        const keyLight = new THREE.DirectionalLight(0xffffff, 1.4)
        keyLight.position.set(2, 4, 3)
        scene.add(keyLight)
        const rimLight = new THREE.DirectionalLight(0x8b6fb3, 0.5)
        rimLight.position.set(-3, 2, -2)
        scene.add(rimLight)

        // Everything rotates around Y together, camera stays fixed - same fixed-camera/rotating-
        // object interaction CharacterCustomizationTurntable.cs used on the Unity side, now driven
        // by mouse drag instead of Unity's Mouse.current.
        const turntable = new THREE.Group()
        // Starts turned 10% of a full rotation off of straight-on, so the preview opens on a
        // slight side angle instead of a flat front view - still fully drag-to-rotate from there.
        turntable.rotation.y = Math.PI * 2 * 0.1
        scene.add(turntable)

        // Shows exactly one mesh per slot - whichever character set's optionId is currently
        // selected for that slot - and hides every other loaded mesh. Safe to call before every
        // set has finished loading; it simply does nothing yet for a slot whose set hasn't
        // arrived.
        function applyVisibility() {
            const sets = characterSetsRef.current || []

            for (const slotName of SLOT_NAMES) {
                const selectedOptionId = selectionsRef.current?.[slotName]
                const owningSet = sets.find((set) =>
                    set.slots.some((s) => s.slot === slotName && s.optionId === selectedOptionId)
                )

                for (const set of sets) {
                    const mesh = meshesRef.current[set.id]?.[slotName]
                    if (mesh) mesh.visible = owningSet != null && set.id === owningSet.id
                }
            }
        }
        applyVisibilityRef.current = applyVisibility

        const loader = new GLTFLoader()
        for (const set of characterSetsRef.current || []) {
            const url = `${API_ORIGIN}/uploads/character-sets/${set.glbFilename}`
            loader.load(
                url,
                (gltf) => {
                    if (disposed) return
                    turntable.add(gltf.scene)

                    const found = {}
                    gltf.scene.traverse((obj) => {
                        // See the file-header note above - every mesh starts hidden so unmapped,
                        // leftover geometry in the file never renders. applyVisibility() below
                        // re-shows only whichever of the 4 matched nodes is actually selected.
                        if (obj.isMesh) obj.visible = false
                        for (const s of set.slots) {
                            if (obj.name === s.meshName) found[s.slot] = obj
                        }
                    })
                    meshesRef.current[set.id] = found
                    applyVisibility()
                },
                undefined,
                (err) => console.error(`[CharacterCustomizer3D] Failed to load ${url}:`, err)
            )
        }

        // Drag-to-rotate - pointermove/pointerup listen on window (not just the canvas) so the drag
        // keeps tracking even if the cursor slips off the canvas mid-drag.
        let isDragging = false
        let lastX = 0
        const rotateSensitivity = 0.01
        const onPointerDown = (e) => { isDragging = true; lastX = e.clientX }
        const onPointerMove = (e) => {
            if (!isDragging) return
            const deltaX = e.clientX - lastX
            lastX = e.clientX
            turntable.rotation.y += deltaX * rotateSensitivity
        }
        const onPointerUp = () => { isDragging = false }
        renderer.domElement.addEventListener('pointerdown', onPointerDown)
        window.addEventListener('pointermove', onPointerMove)
        window.addEventListener('pointerup', onPointerUp)

        let frameId
        const renderLoop = () => {
            renderer.render(scene, camera)
            frameId = requestAnimationFrame(renderLoop)
        }
        renderLoop()

        const onResize = () => {
            camera.aspect = container.clientWidth / container.clientHeight
            camera.updateProjectionMatrix()
            renderer.setSize(container.clientWidth, container.clientHeight)
        }
        window.addEventListener('resize', onResize)

        return () => {
            disposed = true
            cancelAnimationFrame(frameId)
            window.removeEventListener('resize', onResize)
            window.removeEventListener('pointermove', onPointerMove)
            window.removeEventListener('pointerup', onPointerUp)
            renderer.domElement.removeEventListener('pointerdown', onPointerDown)
            renderer.dispose()
            if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement)
        }
    }, [])

    // Re-applies visibility whenever `selections` changes (Previous/Next clicked in the parent
    // page) - the scene/render loop itself is only ever created once, in the effect above.
    useEffect(() => {
        applyVisibilityRef.current()
    }, [selections])

    return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}

export default CharacterCustomizer3D
