import axios from 'axios';
import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Users, Plus, Pencil, Trash2, Save, Upload, X, Gift, Award, ChevronDown, ChevronUp, Clock, Minus, TrendingUp } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { TabsContent } from '../ui/tabs';
import { RewardSettings } from './RewardSettings';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function BonusTab(props) {
  const {
    bonusPrograms,
    setBonusPrograms,
    editingProgram,
    setEditingProgram,
    isNewProgram,
    setIsNewProgram,
    selectedProgramId,
    setSelectedProgramId,
    programUsers,
    setProgramUsers,
    prizeRedemptions,
    setPrizeRedemptions,
    pointsModal,
    setPointsModal,
    bonusImageFileRef,
    bonusBannerFileRef,
    handleFileUpload,
    users,
    uploading
  } = props;

  const [indexPercent, setIndexPercent] = useState('');
  const [indexProgramId, setIndexProgramId] = useState('all');
  const [indexing, setIndexing] = useState(false);
  const bonusHeroFileRef = useRef(null);

  const HERO_PRESETS = [
    { id: 'midnight', name: 'Тёмный', light: false, css: 'linear-gradient(160deg,#0f1729,#070b14)' },
    { id: 'ocean', name: 'Океан', light: false, css: 'linear-gradient(160deg,#04303a,#04121a)' },
    { id: 'royal', name: 'Роял', light: false, css: 'linear-gradient(160deg,#221a4e,#0b1020)' },
    { id: 'mint', name: 'Мятный', light: true, css: 'linear-gradient(135deg,#ecfeff,#a7f3d0,#5eead4)' },
    { id: 'sunset', name: 'Оранж', light: true, css: 'linear-gradient(135deg,#ffe8cc,#fcb24e,#f7922e)' },
    { id: 'snow', name: 'Светлый', light: true, css: 'linear-gradient(135deg,#ffffff,#f1f5f9,#e2e8f0)' },
  ];

  const applyIndexation = async () => {
    const pct = parseFloat(indexPercent);
    if (!pct || pct === 0) { toast.error('Укажите процент (напр. 10 или -5)'); return; }
    setIndexing(true);
    try {
      const body = { percent: pct };
      if (indexProgramId !== 'all') body.program_id = indexProgramId;
      const res = await axios.post(`${API}/admin/bonus/index-prices`, body);
      toast.success(`Цены обновлены: ${res.data.prizes_updated} призов в ${res.data.programs_updated} программах`);
      setIndexPercent('');
      const pr = await axios.get(`${API}/admin/bonus/programs`);
      setBonusPrograms(pr.data || []);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка индексации');
    } finally {
      setIndexing(false);
    }
  };

  return (
    <>
          <TabsContent value="bonus" className="p-6">
            <motion.div 
              className="space-y-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <RewardSettings />

              {/* Header with Add Button */}
              <div className="bg-gradient-to-br from-teal-50/50 to-emerald-50/30 rounded-2xl p-6 border border-teal-100/50">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-teal-500/20">
                      <Gift className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-800">Бонусные программы</h2>
                      <p className="text-sm text-slate-500">{bonusPrograms.length} программ</p>
                    </div>
                  </div>
                  <Button
                    onClick={() => {
                      setEditingProgram({
                        title: 'Новая бонусная программа',
                        description: '',
                        image_url: '',
                        levels: [],
                        prizes: [],
                        enabled: true
                      });
                      setIsNewProgram(true);
                    }}
                    className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white shadow-lg shadow-teal-500/20"
                    data-testid="add-bonus-program-btn"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Добавить программу
                  </Button>
                </div>
              </div>

              {/* Bulk price indexation */}
              <div className="bg-white rounded-2xl p-5 border border-amber-200 shadow-sm" data-testid="bonus-index-prices-card">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
                    <TrendingUp className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800">Массовая индексация цен призов</h3>
                    <p className="text-xs text-slate-500">Изменить стоимость всех призов (и вариантов) на процент</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <Label className="text-[11px] font-bold uppercase text-zinc-500">Процент (%)</Label>
                    <Input
                      type="number"
                      value={indexPercent}
                      onChange={(e) => setIndexPercent(e.target.value)}
                      placeholder="напр. 10 или -5"
                      className="mt-1 w-36 font-mono"
                      data-testid="index-percent-input"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] font-bold uppercase text-zinc-500">Область</Label>
                    <select
                      value={indexProgramId}
                      onChange={(e) => setIndexProgramId(e.target.value)}
                      className="mt-1 block h-10 rounded-md border border-slate-200 bg-white px-3 text-sm min-w-[220px]"
                      data-testid="index-scope-select"
                    >
                      <option value="all">Все программы</option>
                      {bonusPrograms.map(p => (
                        <option key={p.id} value={p.id}>{p.title || 'Без названия'}</option>
                      ))}
                    </select>
                  </div>
                  <Button
                    onClick={applyIndexation}
                    disabled={indexing}
                    className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md"
                    data-testid="apply-index-btn"
                  >
                    {indexing ? 'Применяем…' : 'Применить'}
                  </Button>
                </div>
              </div>

              {/* Programs List */}
              {bonusPrograms.length === 0 ? (
                <div className="bg-white/80 backdrop-blur-sm border border-dashed border-teal-200 rounded-2xl p-12 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-100 to-emerald-100 flex items-center justify-center mx-auto mb-4">
                    <Gift className="w-8 h-8 text-teal-400" />
                  </div>
                  <p className="text-slate-600 font-medium">Нет бонусных программ</p>
                  <p className="text-sm text-slate-400 mt-1">Создайте первую программу для начала работы</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {bonusPrograms.map((program) => (
                    <div key={program.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-lg transition-shadow duration-300">
                      {/* Program Header */}
                      <div 
                        className={`px-6 py-4 flex items-center justify-between cursor-pointer transition-colors ${
                          selectedProgramId === program.id 
                            ? 'bg-gradient-to-r from-teal-50 to-emerald-50 border-b border-teal-200' 
                            : 'hover:bg-slate-50'
                        }`}
                        onClick={async () => {
                          if (selectedProgramId === program.id) {
                            setSelectedProgramId(null);
                            setProgramUsers([]);
                          } else {
                            setSelectedProgramId(program.id);
                            try {
                              const res = await axios.get(`${API}/admin/bonus/programs/${program.id}/users`);
                              setProgramUsers(res.data.users || []);
                            } catch (err) {
                              toast.error('Ошибка загрузки пользователей');
                            }
                          }
                        }}
                      >
                        <div className="flex items-center gap-4">
                          {program.image_url ? (
                            <img src={program.image_url} alt="" className="w-14 h-14 rounded-xl object-cover shadow-sm" />
                          ) : (
                            <div className="w-14 h-14 bg-gradient-to-br from-teal-100 to-emerald-100 rounded-xl flex items-center justify-center">
                              <Gift className="w-7 h-7 text-teal-500" />
                            </div>
                          )}
                          <div>
                            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                              {program.title}
                              {!program.enabled && (
                                <span className="text-xs bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full">Отключена</span>
                              )}
                              {program.pending_requests > 0 && (
                                <span className="text-xs bg-gradient-to-r from-red-500 to-rose-500 text-white px-2.5 py-0.5 rounded-full animate-pulse shadow-sm">
                                  {program.pending_requests} запросов
                                </span>
                              )}
                            </h3>
                            <p className="text-sm text-slate-500 mt-0.5">
                              {program.levels?.length > 0 
                                ? `${program.levels.length} уровней • Баллы по % от уровня`
                                : 'Уровни не настроены'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            className="p-2 rounded-lg bg-slate-100 hover:bg-teal-100 text-slate-500 hover:text-teal-600 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingProgram({...program});
                              setIsNewProgram(false);
                            }}
                            data-testid={`edit-program-${program.id}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            className="p-2 rounded-lg bg-slate-100 hover:bg-red-100 text-slate-500 hover:text-red-500 transition-colors"
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (window.confirm(`Удалить программу "${program.title}"?`)) {
                                try {
                                  await axios.delete(`${API}/admin/bonus/programs/${program.id}`);
                                  toast.success('Программа удалена');
                                  setBonusPrograms(prev => prev.filter(p => p.id !== program.id));
                                  if (selectedProgramId === program.id) {
                                    setSelectedProgramId(null);
                                  }
                                } catch (err) {
                                  toast.error('Ошибка удаления');
                                }
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${
                            selectedProgramId === program.id ? 'rotate-180' : ''
                          }`} />
                        </div>
                      </div>

                      {/* Program Users (Expandable) */}
                      {selectedProgramId === program.id && (
                        <div className="border-t border-slate-100">
                          <div className="bg-gradient-to-r from-slate-50 to-white px-6 py-3 flex items-center gap-2">
                            <Users className="w-4 h-4 text-teal-500" />
                            <span className="text-sm font-medium text-slate-600">Пользователи программы</span>
                            <span className="text-xs bg-teal-100 text-teal-600 px-2 py-0.5 rounded-full">{programUsers.length}</span>
                          </div>
                          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                            <table className="w-full">
                              <thead className="sticky top-0 bg-white shadow-sm">
                                <tr className="bg-slate-50/80">
                                  <th className="text-left py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Пользователь</th>
                                  <th className="text-right py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Баллы</th>
                                  <th className="text-center py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Уровень</th>
                                  <th className="text-center py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Статус</th>
                                  <th className="text-right py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Действия</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {programUsers.map((pu) => (
                                  <tr 
                                    key={pu.id} 
                                    className="transition-colors hover:bg-slate-50"
                                  >
                                    <td className="py-3 px-6">
                                      <span className="font-medium text-slate-800">{pu.name}</span>
                                    </td>
                                    <td className="py-3 px-6 text-right">
                                      <span className="font-mono font-semibold text-slate-700">
                                        {pu.current_amount?.toFixed(0) || 0}
                                      </span>
                                    </td>
                                    <td className="py-3 px-6 text-center">
                                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-teal-100 to-emerald-100 text-teal-700">
                                        {pu.current_level?.name || 'Бронза'}
                                      </span>
                                    </td>
                                    <td className="py-3 px-6 text-center">
                                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500">
                                        Активен
                                      </span>
                                    </td>
                                    <td className="py-3 px-6 text-right">
                                      <div className="flex items-center justify-end gap-1">
                                        <Button size="sm" variant="outline" className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 h-7 px-2 text-xs"
                                          onClick={() => setPointsModal({ action: 'add', userId: pu.id, userName: pu.name, programId: program.id })}
                                          data-testid={`add-points-${pu.id}`}>
                                          <Plus className="w-3 h-3 mr-1" />Начислить
                                        </Button>
                                        <Button size="sm" variant="outline" className="text-red-500 border-red-200 hover:bg-red-50 h-7 px-2 text-xs"
                                          onClick={() => setPointsModal({ action: 'remove', userId: pu.id, userName: pu.name, programId: program.id })}
                                          data-testid={`remove-points-${pu.id}`}>
                                          <Minus className="w-3 h-3 mr-1" />Списать
                                        </Button>
                                        <Button size="sm" variant="ghost" className="text-slate-400 hover:text-red-500 h-7 px-1.5"
                                          onClick={async () => {
                                            if (!window.confirm(`Обнулить баллы для ${pu.name}?`)) return;
                                            try {
                                              await axios.post(`${API}/admin/bonus/programs/${program.id}/users/${pu.id}/reset-points`);
                                              toast.success('Баллы обнулены');
                                              const res = await axios.get(`${API}/admin/bonus/programs/${program.id}/users`);
                                              setProgramUsers(res.data.users || []);
                                            } catch { toast.error('Ошибка'); }
                                          }}
                                          data-testid={`reset-points-${pu.id}`}
                                          title="Обнулить баллы">
                                          <Trash2 className="w-3 h-3" />
                                        </Button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                                {programUsers.length === 0 && (
                                  <tr>
                                    <td colSpan="5" className="py-8 text-center text-slate-400">
                                      <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                      Нет пользователей
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Combined History & Prize Requests Section */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-slate-50 to-white px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-teal-500/20">
                      <Award className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800">История и запросы призов</h3>
                      <p className="text-sm text-slate-500">
                        {prizeRedemptions.length} запросов
                        {prizeRedemptions.filter(r => r.status === 'pending').length > 0 && (
                          <span className="ml-2 text-teal-500 font-medium">
                            ({prizeRedemptions.filter(r => r.status === 'pending').length} ожидают)
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  {prizeRedemptions.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                      <Gift className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>Нет запросов на призы</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {prizeRedemptions.map(redemption => (
                        <div key={redemption.id} className={`p-4 rounded-xl border transition-all hover:shadow-md ${
                          redemption.status === 'pending' ? 'bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200' :
                          redemption.status === 'approved' ? 'bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200' :
                          redemption.status === 'issued' ? 'bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200' :
                          'bg-gradient-to-r from-slate-50 to-slate-100 border-slate-200'
                        }`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-slate-800">{redemption.user_name || redemption.user_email}</p>
                              <p className="text-sm text-slate-600 mt-0.5">
                                Приз: <span className="font-medium text-slate-800">{redemption.prize_name}</span> 
                                <span className="text-slate-400 ml-1">({redemption.points_cost} баллов)</span>
                              </p>
                              <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(redemption.created_at).toLocaleDateString('ru-RU')} — 
                                <span className={`font-medium ${
                                  redemption.status === 'pending' ? 'text-yellow-600' :
                                  redemption.status === 'approved' ? 'text-emerald-600' :
                                  redemption.status === 'issued' ? 'text-blue-600' :
                                  'text-red-600'
                                }`}>
                                  {redemption.status === 'pending' && ' Ожидает'}
                                  {redemption.status === 'approved' && ' Одобрен'}
                                  {redemption.status === 'issued' && ' Выдан'}
                                  {redemption.status === 'rejected' && ' Отклонён'}
                                </span>
                              </p>
                            </div>
                            {redemption.status === 'pending' && (
                              <div className="flex gap-2">
                                <Button size="sm" className="bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white shadow-sm" onClick={async () => {
                                  try {
                                    await axios.put(`${API}/admin/prize-redemptions/${redemption.id}?status=approved`);
                                    setPrizeRedemptions(prev => prev.map(r => r.id === redemption.id ? {...r, status: 'approved'} : r));
                                    toast.success('Приз одобрен');
                                  } catch (err) { toast.error('Ошибка'); }
                                }} data-testid={`approve-prize-${redemption.id}`}>
                                  Одобрить
                                </Button>
                                <Button size="sm" className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-sm" onClick={async () => {
                                  try {
                                    await axios.put(`${API}/admin/prize-redemptions/${redemption.id}?status=issued`);
                                    setPrizeRedemptions(prev => prev.map(r => r.id === redemption.id ? {...r, status: 'issued'} : r));
                                    toast.success('Приз выдан');
                                  } catch (err) { toast.error('Ошибка'); }
                                }} data-testid={`issue-prize-${redemption.id}`}>
                                  Выдать
                                </Button>
                                <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50" onClick={async () => {
                                  try {
                                    await axios.put(`${API}/admin/prize-redemptions/${redemption.id}?status=rejected`);
                                    setPrizeRedemptions(prev => prev.map(r => r.id === redemption.id ? {...r, status: 'rejected'} : r));
                                    toast.success('Приз отклонён');
                                  } catch (err) { toast.error('Ошибка'); }
                                }} data-testid={`reject-prize-${redemption.id}`}>
                                  Отклонить
                                </Button>
                                <Button size="sm" variant="outline" className="border-rose-400 text-rose-700 hover:bg-rose-50" onClick={async () => {
                                  try {
                                    await axios.put(`${API}/admin/prize-redemptions/${redemption.id}?status=rejected&reason=out_of_stock`);
                                    setPrizeRedemptions(prev => prev.map(r => r.id === redemption.id ? {...r, status: 'rejected'} : r));
                                    toast.success('Отклонено: товар закончился. Баллы возвращены, метка включена.');
                                    try {
                                      const res = await axios.get(`${API}/admin/bonus/programs`);
                                      setBonusPrograms(res.data || []);
                                    } catch (e) {}
                                  } catch (err) { toast.error('Ошибка'); }
                                }} data-testid={`reject-oos-prize-${redemption.id}`}>
                                  Нет в наличии
                                </Button>
                              </div>
                            )}
                            {redemption.status === 'approved' && (
                              <Button size="sm" className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-sm" onClick={async () => {
                                try {
                                  await axios.put(`${API}/admin/prize-redemptions/${redemption.id}?status=issued`);
                                  setPrizeRedemptions(prev => prev.map(r => r.id === redemption.id ? {...r, status: 'issued'} : r));
                                  toast.success('Приз выдан');
                                } catch (err) { toast.error('Ошибка'); }
                              }}>
                                Выдать
                              </Button>
                            )}
                            {(redemption.status === 'issued' || redemption.status === 'rejected') && (
                              <Button size="sm" variant="ghost" className="text-slate-400 hover:text-red-500" onClick={async () => {
                                if (!window.confirm('Удалить этот запрос из истории?')) return;
                                try {
                                  await axios.delete(`${API}/admin/bonus/prize-redemptions/${redemption.id}`);
                                  setPrizeRedemptions(prev => prev.filter(r => r.id !== redemption.id));
                                  toast.success('Запрос удалён');
                                } catch (err) { toast.error('Ошибка'); }
                              }} data-testid={`delete-redemption-${redemption.id}`}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </TabsContent>

          {/* Edit Bonus Program Modal */}
          <Dialog open={!!editingProgram} onOpenChange={() => setEditingProgram(null)}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{isNewProgram ? 'Создать бонусную программу' : 'Редактировать программу'}</DialogTitle>
              </DialogHeader>
              {editingProgram && (
                <div className="space-y-4 mt-4">
                  <div>
                    <Label className="text-xs font-bold uppercase text-zinc-500">Заголовок</Label>
                    <Input
                      value={editingProgram.title || ''}
                      onChange={(e) => setEditingProgram({...editingProgram, title: e.target.value})}
                      placeholder="Название программы"
                      className="mt-1"
                    />
                  </div>
                  
                  <div>
                    <Label className="text-xs font-bold uppercase text-zinc-500">Краткое описание</Label>
                    <Input
                      value={editingProgram.description || ''}
                      onChange={(e) => setEditingProgram({...editingProgram, description: e.target.value})}
                      placeholder="Короткое описание для карточки"
                      className="mt-1"
                    />
                  </div>
                  
                  <div>
                    <Label className="text-xs font-bold uppercase text-zinc-500">Расширенное описание</Label>
                    <Textarea
                      value={editingProgram.full_description || ''}
                      onChange={(e) => setEditingProgram({...editingProgram, full_description: e.target.value})}
                      placeholder="Подробное описание программы, условия участия, правила начисления баллов..."
                      className="mt-1 min-h-[100px]"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-bold uppercase text-zinc-500">Изображение программы</Label>
                    <div className="mt-1 flex items-center gap-4">
                      <input
                        type="file"
                        ref={bonusImageFileRef}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const url = await handleFileUpload(file, 'bonus');
                            if (url) {
                              setEditingProgram({...editingProgram, image_url: url});
                            }
                          }
                        }}
                        accept="image/*"
                        className="hidden"
                      />
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => bonusImageFileRef.current?.click()}
                        disabled={uploading}
                        size="sm"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        {uploading ? 'Загрузка...' : 'Загрузить'}
                      </Button>
                      {editingProgram.image_url && (
                        <div className="flex items-center gap-2">
                          <img src={editingProgram.image_url} alt="Preview" className="h-12 object-contain rounded" />
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setEditingProgram({...editingProgram, image_url: ''})}
                            className="text-red-500 h-8 px-2"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Banner Image */}
                  <div className="border-t pt-4">
                    <Label className="text-xs font-bold uppercase text-zinc-500">Баннер (отображается на странице бонусов)</Label>
                    <div className="mt-2">
                      <input
                        type="file"
                        ref={bonusBannerFileRef}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const url = await handleFileUpload(file, 'bonus_banner');
                            if (url) {
                              setEditingProgram({...editingProgram, banner_url: url});
                            }
                          }
                        }}
                        accept="image/*"
                        className="hidden"
                      />
                      
                      {editingProgram.banner_url ? (
                        <div className="space-y-3">
                          <div className="flex justify-center bg-zinc-100 rounded-lg p-4">
                            <img 
                              src={editingProgram.banner_url} 
                              alt="Banner Preview" 
                              className="rounded-lg object-cover"
                              style={{ height: editingProgram.banner_height || 200 }}
                            />
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex-1">
                              <Label className="text-xs text-zinc-500">Высота баннера (px)</Label>
                              <Input
                                type="number"
                                value={editingProgram.banner_height || 200}
                                onChange={(e) => setEditingProgram({...editingProgram, banner_height: parseInt(e.target.value) || 200})}
                                min={100}
                                max={600}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-zinc-500">Размер заголовка (px)</Label>
                              <Input
                                type="number"
                                value={editingProgram.header_font_size || 14}
                                onChange={(e) => setEditingProgram({...editingProgram, header_font_size: parseInt(e.target.value) || 14})}
                                min={12}
                                max={48}
                                className="mt-1"
                              />
                            </div>
                            <div className="flex gap-2 pt-5">
                              <Button 
                                type="button" 
                                variant="outline" 
                                onClick={() => bonusBannerFileRef.current?.click()}
                                disabled={uploading}
                                size="sm"
                              >
                                <Upload className="w-4 h-4 mr-1" />
                                Заменить
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => setEditingProgram({...editingProgram, banner_url: '', banner_height: 200})}
                                className="text-red-500"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => bonusBannerFileRef.current?.click()}
                          disabled={uploading}
                          className="w-full h-24 border-dashed"
                        >
                          <div className="flex flex-col items-center gap-2">
                            <Upload className="w-6 h-6 text-zinc-400" />
                            <span className="text-sm text-zinc-500">{uploading ? 'Загрузка...' : 'Загрузить баннер'}</span>
                          </div>
                        </Button>
                      )}
                      
                      {/* Header Font Size - always visible */}
                      <div className="mt-4">
                        <Label className="text-xs text-zinc-500">Размер заголовка "Бонусная программа" (px)</Label>
                        <Input
                          type="number"
                          value={editingProgram.header_font_size || 14}
                          onChange={(e) => setEditingProgram({...editingProgram, header_font_size: parseInt(e.target.value) || 14})}
                          min={12}
                          max={48}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Hero cover (premium header) */}
                  <div className="border-t pt-4">
                    <Label className="text-xs font-bold uppercase text-zinc-500">Тема оформления блока (по умолчанию для всех клиентов)</Label>
                    <p className="text-[11px] text-zinc-400 mt-0.5 mb-3">Фон верхнего блока страницы бонусов с балансом и уровнями. Клиент может выбрать свою тему, но по умолчанию показывается эта.</p>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {HERO_PRESETS.map((p) => {
                        const active = (editingProgram.hero_preset || 'midnight') === p.id;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setEditingProgram({ ...editingProgram, hero_preset: p.id })}
                            className={`relative h-16 rounded-xl overflow-hidden ring-2 transition-all ${active ? 'ring-orange-500 scale-[1.02]' : 'ring-transparent hover:ring-zinc-300'}`}
                            style={{ background: p.css }}
                            data-testid={`hero-preset-${p.id}`}
                          >
                            <span className={`absolute bottom-1 left-0 right-0 text-center text-[10px] font-semibold ${p.light ? 'text-zinc-700' : 'text-white/90'}`}>{p.name}</span>
                            {active && <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center text-white text-[9px]">✓</span>}
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-3">
                      <Label className="text-xs text-zinc-500">Своё фоновое изображение (необязательно)</Label>
                      <input
                        type="file"
                        ref={bonusHeroFileRef}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const url = await handleFileUpload(file, 'bonus_hero');
                            if (url) setEditingProgram({ ...editingProgram, hero_image_url: url });
                          }
                        }}
                        accept="image/*"
                        className="hidden"
                      />
                      <div className="mt-1 flex items-center gap-3">
                        <Button type="button" variant="outline" size="sm" onClick={() => bonusHeroFileRef.current?.click()} disabled={uploading} data-testid="hero-image-upload">
                          <Upload className="w-4 h-4 mr-2" />
                          {uploading ? 'Загрузка...' : (editingProgram.hero_image_url ? 'Заменить фон' : 'Загрузить фон')}
                        </Button>
                        {editingProgram.hero_image_url && (
                          <div className="flex items-center gap-2">
                            <img src={editingProgram.hero_image_url} alt="Hero" className="h-10 w-16 object-cover rounded ring-1 ring-zinc-200" />
                            <Button variant="ghost" size="sm" onClick={() => setEditingProgram({ ...editingProgram, hero_image_url: '' })} className="text-red-500 h-8 px-2">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Live preview */}
                    {(() => {
                      const ap = HERO_PRESETS.find(h => h.id === (editingProgram.hero_preset || 'midnight')) || HERO_PRESETS[0];
                      return (
                        <div className="mt-3 relative h-24 rounded-2xl overflow-hidden ring-1 ring-zinc-200 flex items-center px-5" style={{ background: ap.css }}>
                          {editingProgram.hero_image_url && (
                            <>
                              <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${editingProgram.hero_image_url})`, opacity: ap.light ? 0.22 : 0.5 }} />
                              <div className="absolute inset-0" style={{ background: ap.light ? 'linear-gradient(180deg, rgba(255,255,255,0.35), rgba(255,255,255,0.8))' : 'linear-gradient(180deg, rgba(5,8,15,0.35), rgba(5,8,15,0.85))' }} />
                            </>
                          )}
                          <div className="relative">
                            <p className={`text-[10px] uppercase tracking-widest ${ap.light ? 'text-zinc-500' : 'text-white/50'}`}>Доступно баллов</p>
                            <p className={`text-2xl font-black bg-clip-text text-transparent ${ap.light ? 'bg-gradient-to-br from-orange-600 to-amber-600' : 'bg-gradient-to-br from-orange-300 via-amber-200 to-orange-400'}`}>1 250</p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Prizes Section */}
                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <Label className="text-xs font-bold uppercase text-zinc-500">Призы</Label>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const newPrize = {
                            id: `prize_${Date.now()}`,
                            name: '',
                            description: '',
                            image_url: '',
                            points_cost: 1000,
                            quantity: -1,
                            enabled: true
                          };
                          setEditingProgram({
                            ...editingProgram, 
                            prizes: [...(editingProgram.prizes || []), newPrize]
                          });
                        }}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Добавить приз
                      </Button>
                    </div>
                    
                    {(editingProgram.prizes || []).length === 0 ? (
                      <p className="text-sm text-zinc-400 text-center py-4">
                        Нет призов. Добавьте призы, которые пользователи смогут получить за баллы.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {(editingProgram.prizes || []).map((prize, idx) => (
                          <div key={prize.id} className="border rounded-lg p-3 bg-zinc-50">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex flex-col gap-0.5 mr-1">
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() => {
                                    const prizes = [...(editingProgram.prizes || [])];
                                    [prizes[idx - 1], prizes[idx]] = [prizes[idx], prizes[idx - 1]];
                                    setEditingProgram({...editingProgram, prizes});
                                  }}
                                  className={`p-0.5 rounded transition-colors ${idx === 0 ? 'text-zinc-300' : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200'}`}
                                  data-testid={`prize-move-up-${idx}`}
                                >
                                  <ChevronUp className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === (editingProgram.prizes || []).length - 1}
                                  onClick={() => {
                                    const prizes = [...(editingProgram.prizes || [])];
                                    [prizes[idx], prizes[idx + 1]] = [prizes[idx + 1], prizes[idx]];
                                    setEditingProgram({...editingProgram, prizes});
                                  }}
                                  className={`p-0.5 rounded transition-colors ${idx === (editingProgram.prizes || []).length - 1 ? 'text-zinc-300' : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200'}`}
                                  data-testid={`prize-move-down-${idx}`}
                                >
                                  <ChevronDown className="w-4 h-4" />
                                </button>
                              </div>
                              <span className="text-xs font-mono text-zinc-400 mt-2 mr-1">#{idx + 1}</span>
                              <Input
                                value={prize.name}
                                onChange={(e) => {
                                  const updatedPrizes = [...(editingProgram.prizes || [])];
                                  updatedPrizes[idx].name = e.target.value;
                                  setEditingProgram({...editingProgram, prizes: updatedPrizes});
                                }}
                                placeholder="Название приза"
                                className="flex-1"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-red-500"
                                onClick={() => {
                                  const updatedPrizes = (editingProgram.prizes || []).filter((_, i) => i !== idx);
                                  setEditingProgram({...editingProgram, prizes: updatedPrizes});
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                            
                            {/* Prize image upload */}
                            <div className="flex items-center gap-3 mb-2">
                              {prize.image_url ? (
                                <img src={prize.image_url} alt={prize.name} className="w-16 h-16 object-cover rounded" />
                              ) : (
                                <div className="w-16 h-16 bg-zinc-200 rounded flex items-center justify-center">
                                  <Gift className="w-6 h-6 text-zinc-400" />
                                </div>
                              )}
                              <div className="flex-1">
                                <input
                                  type="file"
                                  id={`prize-image-${idx}`}
                                  accept="image/*"
                                  className="hidden"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      const url = await handleFileUpload(file, 'prizes');
                                      if (url) {
                                        const updatedPrizes = [...(editingProgram.prizes || [])];
                                        updatedPrizes[idx].image_url = url;
                                        setEditingProgram({...editingProgram, prizes: updatedPrizes});
                                      }
                                    }
                                  }}
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => document.getElementById(`prize-image-${idx}`).click()}
                                  disabled={uploading}
                                >
                                  <Upload className="w-3 h-3 mr-1" />
                                  {prize.image_url ? 'Заменить' : 'Фото'}
                                </Button>
                                {prize.image_url && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-500 ml-1"
                                    onClick={() => {
                                      const updatedPrizes = [...(editingProgram.prizes || [])];
                                      updatedPrizes[idx].image_url = '';
                                      setEditingProgram({...editingProgram, prizes: updatedPrizes});
                                    }}
                                  >
                                    <X className="w-3 h-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                            
                            <Input
                              value={prize.description || ''}
                              onChange={(e) => {
                                const updatedPrizes = [...(editingProgram.prizes || [])];
                                updatedPrizes[idx].description = e.target.value;
                                setEditingProgram({...editingProgram, prizes: updatedPrizes});
                              }}
                              placeholder="Описание приза"
                              className="mb-2"
                            />
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <Label className="text-[10px] text-zinc-400">Стоимость (баллов)</Label>
                                <Input
                                  type="number"
                                  value={prize.points_cost || 0}
                                  onChange={(e) => {
                                    const updatedPrizes = [...(editingProgram.prizes || [])];
                                    updatedPrizes[idx].points_cost = parseFloat(e.target.value) || 0;
                                    setEditingProgram({...editingProgram, prizes: updatedPrizes});
                                  }}
                                  className="mt-1"
                                />
                              </div>
                              <div>
                                <Label className="text-[10px] text-zinc-400">Количество (-1 = ∞)</Label>
                                <Input
                                  type="number"
                                  value={prize.quantity}
                                  onChange={(e) => {
                                    const updatedPrizes = [...(editingProgram.prizes || [])];
                                    updatedPrizes[idx].quantity = parseInt(e.target.value) || -1;
                                    setEditingProgram({...editingProgram, prizes: updatedPrizes});
                                  }}
                                  className="mt-1"
                                />
                              </div>
                              <div className="flex items-end pb-1">
                                <label className="flex items-center gap-2 text-sm">
                                  <input
                                    type="checkbox"
                                    checked={prize.enabled}
                                    onChange={(e) => {
                                      const updatedPrizes = [...(editingProgram.prizes || [])];
                                      updatedPrizes[idx].enabled = e.target.checked;
                                      setEditingProgram({...editingProgram, prizes: updatedPrizes});
                                    }}
                                    className="rounded"
                                  />
                                  Активен
                                </label>
                              </div>
                            </div>

                            {/* Out of stock toggle */}
                            <label className="flex items-center gap-2 text-sm mt-2 cursor-pointer select-none" data-testid={`prize-out-of-stock-${idx}`}>
                              <input
                                type="checkbox"
                                checked={!!prize.out_of_stock}
                                onChange={(e) => {
                                  const updatedPrizes = [...(editingProgram.prizes || [])];
                                  updatedPrizes[idx].out_of_stock = e.target.checked;
                                  setEditingProgram({...editingProgram, prizes: updatedPrizes});
                                }}
                                className="rounded"
                              />
                              <span className={prize.out_of_stock ? 'text-rose-600 font-medium' : 'text-zinc-600'}>
                                Товар закончился (метка «Закончился»)
                              </span>
                            </label>

                            {/* Extra parameters / variants */}
                            <div className="mt-3 border-t border-zinc-200 pt-3">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-[11px] font-bold uppercase text-zinc-400">Доп. параметры (цвет, память…)</span>
                                <Button type="button" size="sm" variant="outline" className="h-7 text-xs"
                                  onClick={() => {
                                    const updatedPrizes = [...(editingProgram.prizes || [])];
                                    const groups = updatedPrizes[idx].options || [];
                                    updatedPrizes[idx].options = [...groups, { id: `grp_${Date.now()}`, name: '', choices: [] }];
                                    setEditingProgram({...editingProgram, prizes: updatedPrizes});
                                  }}
                                  data-testid={`prize-add-option-group-${idx}`}
                                >
                                  <Plus className="w-3 h-3 mr-1" /> Группа
                                </Button>
                              </div>
                              {(prize.options || []).length === 0 ? (
                                <p className="text-xs text-zinc-400">Нет доп. параметров.</p>
                              ) : (
                                <div className="space-y-2">
                                  {(prize.options || []).map((grp, gIdx) => (
                                    <div key={grp.id} className="rounded-lg border border-zinc-200 bg-white p-2">
                                      <div className="flex items-center gap-2 mb-2">
                                        <Input
                                          value={grp.name}
                                          onChange={(e) => {
                                            const updatedPrizes = [...(editingProgram.prizes || [])];
                                            updatedPrizes[idx].options[gIdx].name = e.target.value;
                                            setEditingProgram({...editingProgram, prizes: updatedPrizes});
                                          }}
                                          placeholder="Название группы (напр. Цвет)"
                                          className="h-8 text-sm flex-1"
                                        />
                                        <Button type="button" size="sm" variant="ghost" className="text-red-500 h-8 px-2"
                                          onClick={() => {
                                            const updatedPrizes = [...(editingProgram.prizes || [])];
                                            updatedPrizes[idx].options = updatedPrizes[idx].options.filter((_, i) => i !== gIdx);
                                            setEditingProgram({...editingProgram, prizes: updatedPrizes});
                                          }}
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                      </div>
                                      <div className="space-y-1.5 pl-1">
                                        {(grp.choices || []).map((ch, cIdx) => (
                                          <div key={ch.id} className="flex items-center gap-2">
                                            <Input
                                              value={ch.label}
                                              onChange={(e) => {
                                                const updatedPrizes = [...(editingProgram.prizes || [])];
                                                updatedPrizes[idx].options[gIdx].choices[cIdx].label = e.target.value;
                                                setEditingProgram({...editingProgram, prizes: updatedPrizes});
                                              }}
                                              placeholder="Вариант (напр. Красный)"
                                              className="h-7 text-xs flex-1"
                                            />
                                            <div className="flex items-center gap-1">
                                              <span className="text-[10px] text-zinc-400">+</span>
                                              <Input
                                                type="number"
                                                value={ch.points ?? 0}
                                                onChange={(e) => {
                                                  const updatedPrizes = [...(editingProgram.prizes || [])];
                                                  updatedPrizes[idx].options[gIdx].choices[cIdx].points = parseInt(e.target.value) || 0;
                                                  setEditingProgram({...editingProgram, prizes: updatedPrizes});
                                                }}
                                                className="h-7 text-xs w-20"
                                              />
                                              <span className="text-[10px] text-zinc-400">б.</span>
                                            </div>
                                            <Button type="button" size="sm" variant="ghost" className="text-red-400 h-7 px-1.5"
                                              onClick={() => {
                                                const updatedPrizes = [...(editingProgram.prizes || [])];
                                                updatedPrizes[idx].options[gIdx].choices = updatedPrizes[idx].options[gIdx].choices.filter((_, i) => i !== cIdx);
                                                setEditingProgram({...editingProgram, prizes: updatedPrizes});
                                              }}
                                            >
                                              <X className="w-3 h-3" />
                                            </Button>
                                          </div>
                                        ))}
                                        <Button type="button" size="sm" variant="ghost" className="h-7 text-xs text-teal-600"
                                          onClick={() => {
                                            const updatedPrizes = [...(editingProgram.prizes || [])];
                                            const choices = updatedPrizes[idx].options[gIdx].choices || [];
                                            updatedPrizes[idx].options[gIdx].choices = [...choices, { id: `ch_${Date.now()}`, label: '', points: 0 }];
                                            setEditingProgram({...editingProgram, prizes: updatedPrizes});
                                          }}
                                          data-testid={`prize-add-choice-${idx}-${gIdx}`}
                                        >
                                          <Plus className="w-3 h-3 mr-1" /> Вариант
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Levels Section - Multi-tier system */}
                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <Label className="text-xs font-bold uppercase text-zinc-500">Уровни программы</Label>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const newLevel = {
                            id: `level_${Date.now()}`,
                            name: '',
                            min_points: 0,
                            cashback_percent: 0,
                            color: '#f97316',
                            benefits: ''
                          };
                          setEditingProgram({
                            ...editingProgram, 
                            levels: [...(editingProgram.levels || []), newLevel]
                          });
                        }}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Добавить уровень
                      </Button>
                    </div>
                    
                    {(editingProgram.levels || []).length === 0 ? (
                      <p className="text-sm text-zinc-400 text-center py-4">
                        Нет уровней. Добавьте уровни для многоуровневой бонусной программы (например: Бронза, Серебро, Золото).
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {(editingProgram.levels || []).map((level, idx) => (
                          <div key={level.id} className="border rounded-lg p-3" style={{ borderLeftColor: level.color, borderLeftWidth: '4px' }}>
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <Input
                                value={level.name}
                                onChange={(e) => {
                                  const updatedLevels = [...(editingProgram.levels || [])];
                                  updatedLevels[idx].name = e.target.value;
                                  setEditingProgram({...editingProgram, levels: updatedLevels});
                                }}
                                placeholder="Название уровня (напр: Золото)"
                                className="flex-1"
                              />
                              <input
                                type="color"
                                value={level.color || '#f97316'}
                                onChange={(e) => {
                                  const updatedLevels = [...(editingProgram.levels || [])];
                                  updatedLevels[idx].color = e.target.value;
                                  setEditingProgram({...editingProgram, levels: updatedLevels});
                                }}
                                className="w-10 h-10 rounded cursor-pointer"
                                title="Цвет уровня"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-red-500"
                                onClick={() => {
                                  const updatedLevels = (editingProgram.levels || []).filter((_, i) => i !== idx);
                                  setEditingProgram({...editingProgram, levels: updatedLevels});
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mb-2">
                              <div>
                                <Label className="text-[10px] text-zinc-400">Мин. баллов для уровня</Label>
                                <Input
                                  type="number"
                                  value={level.min_points || 0}
                                  onChange={(e) => {
                                    const updatedLevels = [...(editingProgram.levels || [])];
                                    updatedLevels[idx].min_points = parseFloat(e.target.value) || 0;
                                    setEditingProgram({...editingProgram, levels: updatedLevels});
                                  }}
                                  className="mt-1"
                                />
                              </div>
                              <div>
                                <Label className="text-[10px] text-zinc-400">Кешбэк (%)</Label>
                                <Input
                                  type="number"
                                  value={level.cashback_percent || 0}
                                  onChange={(e) => {
                                    const updatedLevels = [...(editingProgram.levels || [])];
                                    updatedLevels[idx].cashback_percent = parseFloat(e.target.value) || 0;
                                    setEditingProgram({...editingProgram, levels: updatedLevels});
                                  }}
                                  className="mt-1"
                                  min="0"
                                  max="100"
                                />
                              </div>
                            </div>
                            <div>
                              <Label className="text-[10px] text-zinc-400">Привилегии уровня</Label>
                              <Input
                                value={level.benefits || ''}
                                onChange={(e) => {
                                  const updatedLevels = [...(editingProgram.levels || [])];
                                  updatedLevels[idx].benefits = e.target.value;
                                  setEditingProgram({...editingProgram, levels: updatedLevels});
                                }}
                                placeholder="Например: Бесплатная доставка, приоритетная поддержка"
                                className="mt-1"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={editingProgram.enabled}
                      onCheckedChange={(checked) => setEditingProgram({...editingProgram, enabled: checked})}
                    />
                    <span className={editingProgram.enabled ? 'text-green-600' : 'text-zinc-400'}>
                      {editingProgram.enabled ? 'Активна' : 'Отключена'}
                    </span>
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={() => setEditingProgram(null)}>
                      Отмена
                    </Button>
                    <Button
                      onClick={async () => {
                        try {
                          if (isNewProgram) {
                            const res = await axios.post(`${API}/admin/bonus/programs`, editingProgram);
                            toast.success('Программа создана');
                            setBonusPrograms(prev => [...prev, res.data]);
                          } else {
                            await axios.put(`${API}/admin/bonus/programs/${editingProgram.id}`, editingProgram);
                            toast.success('Программа обновлена');
                            setBonusPrograms(prev => prev.map(p => p.id === editingProgram.id ? { ...p, ...editingProgram } : p));
                          }
                          setEditingProgram(null);
                        } catch (err) {
                          toast.error(err.response?.data?.detail || 'Ошибка сохранения');
                        }
                      }}
                      className="bg-teal-500 hover:bg-teal-600"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {isNewProgram ? 'Создать' : 'Сохранить'}
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Points Management Modal */}
          <Dialog open={!!pointsModal} onOpenChange={() => setPointsModal(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {pointsModal?.action === 'add' ? (
                    <><Plus className="w-5 h-5 text-emerald-500" /> Начислить баллы</>
                  ) : (
                    <><Minus className="w-5 h-5 text-red-500" /> Списать баллы</>
                  )}
                </DialogTitle>
              </DialogHeader>
              {pointsModal && (
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  const fd = new FormData(e.target);
                  const amount = parseFloat(fd.get('amount'));
                  const reason = fd.get('reason') || '';
                  if (!amount || amount <= 0) { toast.error('Укажите сумму'); return; }
                  try {
                    const url = pointsModal.action === 'add'
                      ? `${API}/admin/bonus/programs/${pointsModal.programId}/users/${pointsModal.userId}/add-points`
                      : `${API}/admin/bonus/programs/${pointsModal.programId}/users/${pointsModal.userId}/remove-points`;
                    const res = await axios.post(url, { amount, reason });
                    toast.success(`${pointsModal.action === 'add' ? 'Начислено' : 'Списано'}: ${amount} баллов`);
                    setPointsModal(null);
                    const usersRes = await axios.get(`${API}/admin/bonus/programs/${pointsModal.programId}/users`);
                    setProgramUsers(usersRes.data.users || []);
                  } catch (err) { toast.error(err.response?.data?.detail || 'Ошибка'); }
                }} className="space-y-4">
                  <div className="bg-slate-50 p-3 rounded-lg">
                    <p className="font-medium text-slate-800">{pointsModal.userName}</p>
                  </div>
                  <div>
                    <Label className="text-xs font-bold uppercase text-zinc-500">Количество баллов</Label>
                    <Input name="amount" type="number" min="1" step="1" required autoFocus placeholder="100" className="mt-1 font-mono" data-testid="points-amount-input" />
                  </div>
                  <div>
                    <Label className="text-xs font-bold uppercase text-zinc-500">Причина (опц.)</Label>
                    <Input name="reason" placeholder="Бонус за отзыв" className="mt-1" data-testid="points-reason-input" />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" type="button" onClick={() => setPointsModal(null)}>Отмена</Button>
                    <Button type="submit" className={pointsModal.action === 'add' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-red-500 hover:bg-red-600'} data-testid="points-submit-btn">
                      {pointsModal.action === 'add' ? 'Начислить' : 'Списать'}
                    </Button>
                  </div>
                </form>
              )}
            </DialogContent>
          </Dialog>
    </>
  );
}
