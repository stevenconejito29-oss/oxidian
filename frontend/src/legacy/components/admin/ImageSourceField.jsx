import React from 'react'
import toast from 'react-hot-toast'
import styles from '../../pages/Admin.module.css'

async function readFileAsDataUrl(file) {
  if (!file) return ''
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'))
    reader.readAsDataURL(file)
  })
}

export default function ImageSourceField({
  label = 'Imagen',
  hint = 'Puedes pegar URL o subir archivo',
  value = '',
  onChange,
  placeholder = 'https://...',
}) {
  async function handleFileChange(event) {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.size > 900 * 1024) {
      toast.error('La imagen supera el limite recomendado de 900 KB')
      event.target.value = ''
      return
    }
    try {
      const dataUrl = await readFileAsDataUrl(file)
      onChange(dataUrl)
    } catch (error) {
      toast.error(error.message || 'No se pudo cargar la imagen')
    }
    event.target.value = ''
  }

  return (
    <div className={styles.formGroup}>
      <label className={styles.formLabel}>{label} <span className={styles.formHint}>- {hint}</span></label>
      <input
        value={value || ''}
        onChange={event => onChange(event.target.value)}
        className={styles.input}
        placeholder={placeholder}
      />
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:8, alignItems:'center' }}>
        <label className={styles.cancelBtn} style={{ cursor:'pointer' }}>
          Subir archivo
          <input type="file" accept="image/*" onChange={handleFileChange} style={{ display:'none' }} />
        </label>
        {value && (
          <button type="button" className={styles.deleteBtn} onClick={() => onChange('')}>
            Limpiar imagen
          </button>
        )}
      </div>
      {value && (
        <img
          src={value}
          alt=""
          className={styles.imagePreview}
          onError={event => { event.currentTarget.style.display = 'none' }}
        />
      )}
    </div>
  )
}
