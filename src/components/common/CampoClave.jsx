import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

// 09/11/2026: campo de contraseña con un ojo para ver lo que se escribe (Usuarios, login y
// "Cambia tu contraseña"). Arranca oculta. Recibe las mismas props que un <input>; la clase
// del input se respeta y se le deja espacio a la derecha para el ojo.
export default function CampoClave({ className = '', ...props }) {
  const [ver, setVer] = useState(false);
  const texto = ver ? 'Ocultar contraseña' : 'Mostrar contraseña';

  return (
    <div className="relative">
      <input {...props} type={ver ? 'text' : 'password'} className={`${className} pr-11`} />
      <button
        type="button"
        onClick={() => setVer((v) => !v)}
        title={texto}
        aria-label={texto}
        aria-pressed={ver}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
      >
        {ver ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
