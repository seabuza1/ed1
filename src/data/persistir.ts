/** Pede ao navegador para não apagar os dados (IndexedDB) quando faltar espaço. */
export async function pedirPersistencia(): Promise<void> {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist()
    }
  } catch {
    // sem suporte: segue sem persistência garantida
  }
}
