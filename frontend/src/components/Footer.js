import { useState, useEffect } from 'react';
import { Mail, MapPin, Send } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Footer() {
  const { isDark } = useTheme();
  const [footer, setFooter] = useState(null);

  useEffect(() => {
    axios.get(`${API}/maintenance/footer`).then(r => setFooter(r.data)).catch(() => {});
  }, []);

  if (!footer) return null;
  const hasContacts = footer.email || footer.address || footer.telegram || footer.whatsapp || footer.vk;
  if (!hasContacts && !footer.copyright) return null;

  return (
    <footer className={`mt-auto border-t ${isDark ? 'bg-zinc-900/80 border-zinc-800 text-zinc-400' : 'bg-white border-slate-200 text-slate-500'}`} data-testid="site-footer">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row gap-6 md:gap-12 justify-between">
          {/* Contacts */}
          {hasContacts && (
            <div className="space-y-3">
              <h4 className={`text-sm font-bold uppercase tracking-wider ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>Контакты</h4>
              {footer.email && (
                <a href={`mailto:${footer.email}`} className="flex items-center gap-2 text-sm hover:underline" data-testid="footer-email">
                  <Mail className="w-4 h-4 shrink-0" />
                  {footer.email}
                </a>
              )}
              {footer.address && (
                <p className="flex items-center gap-2 text-sm" data-testid="footer-address">
                  <MapPin className="w-4 h-4 shrink-0" />
                  {footer.address}
                </p>
              )}
            </div>
          )}

          {/* Social */}
          {(footer.telegram || footer.whatsapp || footer.vk) && (
            <div className="space-y-3">
              <h4 className={`text-sm font-bold uppercase tracking-wider ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>Мы в сетях</h4>
              <div className="flex gap-3">
                {footer.telegram && (
                  <a href={footer.telegram} target="_blank" rel="noopener noreferrer"
                    className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${isDark ? 'bg-zinc-800 hover:bg-teal-500/20 text-zinc-400 hover:text-teal-400' : 'bg-slate-100 hover:bg-teal-500/10 text-slate-500 hover:text-teal-600'}`}
                    data-testid="footer-telegram">
                    <Send className="w-4 h-4" />
                  </a>
                )}
                {footer.whatsapp && (
                  <a href={footer.whatsapp} target="_blank" rel="noopener noreferrer"
                    className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${isDark ? 'bg-zinc-800 hover:bg-green-500/20 text-zinc-400 hover:text-green-400' : 'bg-slate-100 hover:bg-green-500/10 text-slate-500 hover:text-green-600'}`}
                    data-testid="footer-whatsapp">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  </a>
                )}
                {footer.vk && (
                  <a href={footer.vk} target="_blank" rel="noopener noreferrer"
                    className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${isDark ? 'bg-zinc-800 hover:bg-blue-500/20 text-zinc-400 hover:text-blue-400' : 'bg-slate-100 hover:bg-blue-500/10 text-slate-500 hover:text-blue-600'}`}
                    data-testid="footer-vk">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M15.684 0H8.316C1.592 0 0 1.592 0 8.316v7.368C0 22.408 1.592 24 8.316 24h7.368C22.408 24 24 22.408 24 15.684V8.316C24 1.592 22.391 0 15.684 0zm3.692 17.123h-1.744c-.66 0-.862-.525-2.049-1.714-1.033-1.01-1.49-1.135-1.744-1.135-.356 0-.458.102-.458.593v1.575c0 .424-.135.678-1.253.678-1.846 0-3.896-1.12-5.335-3.202C4.624 10.857 4.03 8.57 4.03 8.096c0-.254.102-.491.593-.491h1.744c.44 0 .61.203.78.677.864 2.49 2.303 4.675 2.896 4.675.22 0 .322-.102.322-.66V9.721c-.068-1.186-.695-1.287-.695-1.71 0-.204.17-.407.44-.407h2.744c.373 0 .508.203.508.643v3.473c0 .372.17.508.271.508.22 0 .407-.136.813-.542 1.253-1.406 2.151-3.574 2.151-3.574.119-.254.322-.491.762-.491h1.744c.525 0 .644.27.525.643-.22 1.017-2.354 4.031-2.354 4.031-.186.305-.254.44 0 .78.186.254.796.779 1.203 1.253.745.847 1.32 1.558 1.473 2.049.17.49-.085.744-.576.744z"/></svg>
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Copyright */}
        {footer.copyright && (
          <div className={`mt-6 pt-4 border-t text-center text-xs ${isDark ? 'border-zinc-800' : 'border-slate-200'}`} data-testid="footer-copyright">
            {footer.copyright}
          </div>
        )}
      </div>
    </footer>
  );
}
