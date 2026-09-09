import { useEffect, useMemo, useState, type FormEvent, type ReactNode, type CSSProperties } from 'react';
import {
  ArrowDownLeft, ArrowUpRight, BarChart3, Bell, CalendarDays, ChevronDown,
  CreditCard, Download, Landmark, LayoutDashboard, LogOut, Mail, Menu, Pencil, Plus, RefreshCcw, Search,
  Send, Settings, ShieldCheck, Sparkles, Target, Trash2, TrendingUp, WalletCards, X, Zap
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { AuthProvider, useAuth } from '@/lib/auth';
import { AuthPage } from '@/components/AuthPage';

type Tab = 'overview' | 'transactions' | 'budget' | 'savings' | 'wallets' | 'reports';
type TransactionType = 'income' | 'expense' | 'transfer' | 'savings';
type Account = { id: string; name: string; type: string; opening_balance: number; color: string };
type Transaction = { id: string; account_id: string | null; type: TransactionType; amount: number; category: string; description: string; transaction_date: string; recurring: boolean; goal_id: string | null };
type Goal = { id: string; name: string; target_amount: number; current_amount: number; target_date: string | null; color: string };
type Settings = { user_id: string; monthly_budget: number; savings_target: number; currency: string; category_budgets: Record<string, number>; budget_month: string | null };
type BudgetHistoryEntry = { id: string; month: string; monthly_budget: number; category_budgets: Record<string, number>; total_spent: number; category_spent: Record<string, number> };
type PendingSalary = { id: string; payload: Omit<Transaction, 'id'>[]; cutoff: string; created_at: string };

const peso = (value: number) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(value);
const today = new Date().toISOString().slice(0, 10);
const monthName = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(new Date());
const categories = ['Food', 'Transport', 'Bills', 'Shopping', 'Entertainment', 'Health', 'Housing', 'Savings', 'Salary', 'Freelance', 'Other'];
const incomeCategories = ['Salary', 'Freelance', 'Food allowance', 'Other'];
const categoryOptions = Array.from(new Set([...categories, ...incomeCategories]));
const accountColors = ['#4f46e5', '#0284c7', '#d97706', '#e11d48', '#7c3aed', '#0d9488'];
const donutColors = ['#4f46e5', '#0284c7', '#d97706', '#e11d48', '#7c3aed', '#0d9488'];
// Ang mga wallet/goal na ginawa bago ma-update ang color palette ay may
// naka-save nang lumang berdeng kulay sa database. Dito natin ina-align sa
// bagong palette ang mga lumang kulay tuwing ipapakita, para consistent
// ang itsura kahit hindi na kailangang i-migrate ang datos sa Supabase.
const legacyColorMap: Record<string, string> = {
  '#1d6b58': '#4f46e5',
  '#5b7c99': '#0284c7',
  '#d5a942': '#d97706',
  '#e58068': '#e11d48',
  '#7b5c9e': '#7c3aed',
  '#3d8a8a': '#0d9488',
};
const displayColor = (hex: string) => legacyColorMap[hex?.toLowerCase?.()] ?? hex;

function Dashboard() {
  const { user, signOut } = useAuth();
  const displayName = user?.email?.split('@')[0] ?? 'User';
  const initials = displayName.slice(0, 2).toUpperCase();
  const greetingName = displayName.charAt(0).toUpperCase() + displayName.slice(1);
  const [tab, setTab] = useState<Tab>('overview');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [settings, setSettings] = useState<Settings>({ user_id: '', monthly_budget: 30000, savings_target: 20, currency: 'PHP', category_budgets: {}, budget_month: null });
  const [budgetHistory, setBudgetHistory] = useState<BudgetHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [noticeType, setNoticeType] = useState<'success' | 'error'>('success');
  const [modal, setModal] = useState<TransactionType | 'goal' | 'wallet' | 'salary' | null>(null);
  const [pendingSalaries, setPendingSalaries] = useState<PendingSalary[]>([]);
  const [pendingSalaryOpen, setPendingSalaryOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editingWallet, setEditingWallet] = useState<Account | null>(null);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [search, setSearch] = useState('');
  const [emailModalOpen, setEmailModalOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const [accountResult, transactionResult, goalResult, settingsResult, pendingSalaryResult, budgetHistoryResult] = await Promise.all([
      supabase.from('wallet_accounts').select('*').order('created_at'),
      supabase.from('wallet_transactions').select('*').order('transaction_date', { ascending: false }),
      supabase.from('wallet_goals').select('*').order('created_at'),
      supabase.from('wallet_settings').select('*').maybeSingle(),
      supabase.from('wallet_pending_salary').select('*').order('created_at'),
      supabase.from('wallet_budget_history').select('*').order('month', { ascending: false }),
    ]);
    if (accountResult.error || transactionResult.error || goalResult.error) {
      setNoticeType('error'); setNotice('Your workspace could not be loaded. Please refresh.'); setLoading(false); return;
    }
    setAccounts((accountResult.data ?? []) as Account[]);
    const allTransactions = (transactionResult.data ?? []) as Transaction[];
    setTransactions(allTransactions);
    setGoals((goalResult.data ?? []) as Goal[]);
    setPendingSalaries((pendingSalaryResult.data ?? []) as PendingSalary[]);
    let history = (budgetHistoryResult.data ?? []) as BudgetHistoryEntry[];
    const currentMonth = today.slice(0, 7);

    if (!settingsResult.data) {
      const { data: newSettings } = await supabase.from('wallet_settings').upsert({ monthly_budget: 30000, savings_target: 20, currency: 'PHP', category_budgets: {}, budget_month: currentMonth }).select().maybeSingle();
      if (newSettings) setSettings({ ...(newSettings as Settings), category_budgets: (newSettings as Settings).category_budgets ?? {} });
    } else {
      let loadedSettings = { ...(settingsResult.data as Settings), category_budgets: (settingsResult.data as Settings).category_budgets ?? {} };
      // Kapag lumipas na ang buwan mula sa huling beses na na-save ang budget,
      // i-lock-in muna bilang history ang budget vs aktwal na gastos noong
      // nakaraang buwan bago tuluyang lumipat sa bagong buwan.
      if (loadedSettings.budget_month && loadedSettings.budget_month !== currentMonth) {
        const pastMonth = loadedSettings.budget_month;
        const pastMonthExpenses = allTransactions.filter((item) => item.type === 'expense' && item.transaction_date.slice(0, 7) === pastMonth);
        const totalSpent = pastMonthExpenses.reduce((sum, item) => sum + Number(item.amount), 0);
        const categorySpent: Record<string, number> = {};
        pastMonthExpenses.forEach((item) => { categorySpent[item.category] = (categorySpent[item.category] ?? 0) + Number(item.amount); });
        const { data: archived } = await supabase.from('wallet_budget_history').upsert({ month: pastMonth, monthly_budget: loadedSettings.monthly_budget, category_budgets: loadedSettings.category_budgets, total_spent: totalSpent, category_spent: categorySpent, user_id: user!.id }, { onConflict: 'user_id,month' }).select().maybeSingle();
        if (archived) history = [archived as BudgetHistoryEntry, ...history.filter((entry) => entry.month !== pastMonth)];
      }
      if (loadedSettings.budget_month !== currentMonth) {
        const { data: rolled } = await supabase.from('wallet_settings').update({ budget_month: currentMonth }).eq('user_id', user!.id).select().maybeSingle();
        if (rolled) loadedSettings = { ...(rolled as Settings), category_budgets: (rolled as Settings).category_budgets ?? {} };
      }
      setSettings(loadedSettings);
    }
    setBudgetHistory(history);
    setLoading(false);
  };

  useEffect(() => { void loadData(); }, []);
  useEffect(() => { if (notice) { const timer = window.setTimeout(() => setNotice(''), 3500); return () => window.clearTimeout(timer); } }, [notice]);

  const currentMonthTransactions = useMemo(() => transactions.filter((item) => item.transaction_date.slice(0, 7) === today.slice(0, 7)), [transactions]);
  const totals = useMemo(() => {
    const income = currentMonthTransactions.filter((item) => item.type === 'income').reduce((sum, item) => sum + Number(item.amount), 0);
    const expenses = currentMonthTransactions.filter((item) => item.type === 'expense').reduce((sum, item) => sum + Number(item.amount), 0);
    const savings = currentMonthTransactions.filter((item) => item.type === 'savings').reduce((sum, item) => sum + Number(item.amount), 0);
    // Separate figure: savings that are actually tied to a goal. "savings"
    // above still counts ALL savings (goal-linked or not) since all of it
    // should leave the spendable balance — but "goalSavings" is what should
    // be shown as progress toward your goals ("This month saved").
    const goalSavings = currentMonthTransactions.filter((item) => item.type === 'savings' && item.goal_id).reduce((sum, item) => sum + Number(item.amount), 0);
    const opening = accounts.reduce((sum, account) => sum + Number(account.opening_balance), 0);
    // Savings amounts are treated like an expense here on purpose: once money
    // moves into savings it should disappear from the spendable total balance
    // so it isn't accidentally counted as available money to touch/spend.
    const net = income - expenses - savings;
    return { income, expenses, savings, goalSavings, balance: opening + net, available: settings.monthly_budget - expenses };
  }, [accounts, currentMonthTransactions, settings.monthly_budget]);
  const spendingByCategory = useMemo(() => categories.map((category) => ({ category, amount: currentMonthTransactions.filter((item) => item.type === 'expense' && item.category === category).reduce((sum, item) => sum + Number(item.amount), 0) })).filter((item) => item.amount > 0).sort((a, b) => b.amount - a.amount), [currentMonthTransactions]);
  const filteredTransactions = transactions.filter((item) => `${item.description} ${item.category} ${item.type}`.toLowerCase().includes(search.toLowerCase()));
  const healthScore = Math.max(0, Math.min(100, Math.round((totals.income ? (totals.income - totals.expenses) / totals.income * 45 : 0) + (totals.income ? totals.goalSavings / totals.income * 35 : 0) + (totals.expenses <= settings.monthly_budget ? 20 : 0))));
  const monthlyData = useMemo(() => {
    const months: { label: string; income: number; expenses: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const key = d.toISOString().slice(0, 7);
      const label = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(d);
      const income = transactions.filter((t) => t.transaction_date.slice(0, 7) === key && t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
      const expenses = transactions.filter((t) => t.transaction_date.slice(0, 7) === key && t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
      months.push({ label, income, expenses });
    }
    return months;
  }, [transactions]);

  const notify = (msg: string, type: 'success' | 'error' = 'success') => { setNoticeType(type); setNotice(msg); };
  const openAddModal = (type: TransactionType | 'goal' | 'wallet' | 'salary') => { setEditingTransaction(null); setEditingWallet(null); setEditingGoal(null); setModal(type); };

  // Kapag savings transaction may naka-link na goal, dito ito idinadagdag
  // (o binabawas, kung negative ang delta) sa current_amount ng goal na iyon.
  const adjustGoalAmount = async (goalId: string | null, delta: number) => {
    if (!goalId || !delta) return;
    const goal = goals.find((item) => item.id === goalId);
    if (!goal) return;
    const nextAmount = Math.max(0, Number(goal.current_amount) + delta);
    const { data, error } = await supabase.from('wallet_goals').update({ current_amount: nextAmount }).eq('id', goalId).select().maybeSingle();
    if (!error && data) setGoals((current) => current.map((item) => item.id === goalId ? (data as Goal) : item));
  };
  const addTransaction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const type = form.get('type') as TransactionType;
    const amount = Number(form.get('amount'));
    const goalId = type === 'savings' ? (String(form.get('goal_id') || '') || null) : null;
    const payload = { type, amount, category: String(form.get('category')), description: String(form.get('description')), account_id: String(form.get('account_id')), transaction_date: String(form.get('transaction_date')), recurring: form.get('recurring') === 'on', goal_id: goalId, user_id: user!.id };
    const { data, error } = await supabase.from('wallet_transactions').insert(payload).select().maybeSingle();
    if (error || !data) { notify(error?.message ?? 'That entry could not be saved.', 'error'); return; }
    setTransactions((current) => [data as Transaction, ...current]); setModal(null); notify('Transaction saved.');
    if (type === 'savings' && goalId) await adjustGoalAmount(goalId, amount);
  };
  const updateTransaction = async (id: string, event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const type = form.get('type') as TransactionType;
    const amount = Number(form.get('amount'));
    const goalId = type === 'savings' ? (String(form.get('goal_id') || '') || null) : null;
    const payload = { type, amount, category: String(form.get('category')), description: String(form.get('description')), account_id: String(form.get('account_id')), transaction_date: String(form.get('transaction_date')), recurring: form.get('recurring') === 'on', goal_id: goalId };
    const oldTransaction = transactions.find((item) => item.id === id);
    const { data, error } = await supabase.from('wallet_transactions').update(payload).eq('id', id).select().maybeSingle();
    if (error || !data) { notify(error?.message ?? 'That entry could not be updated.', 'error'); return; }
    setTransactions((current) => current.map((item) => item.id === id ? (data as Transaction) : item));
    setModal(null); setEditingTransaction(null); notify('Transaction updated.');
    // I-reverse muna ang dating contribution (kung meron) bago idagdag ang bago,
    // para hindi ma-double count kapag pinalitan ang amount o goal.
    if (oldTransaction?.type === 'savings' && oldTransaction.goal_id) await adjustGoalAmount(oldTransaction.goal_id, -Number(oldTransaction.amount));
    if (type === 'savings' && goalId) await adjustGoalAmount(goalId, amount);
  };
  const deleteTransaction = async (id: string) => {
    const target = transactions.find((item) => item.id === id);
    const { error } = await supabase.from('wallet_transactions').delete().eq('id', id);
    if (!error) {
      setTransactions((current) => current.filter((item) => item.id !== id));
      notify('Transaction removed.');
      if (target?.type === 'savings' && target.goal_id) await adjustGoalAmount(target.goal_id, -Number(target.amount));
    }
  };
  const addGoal = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); const { data, error } = await supabase.from('wallet_goals').insert({ name: String(form.get('name')), target_amount: Number(form.get('target_amount')), current_amount: Number(form.get('current_amount') ?? 0), target_date: String(form.get('target_date')), color: donutColors[goals.length % donutColors.length], user_id: user!.id }).select().maybeSingle(); if (!error && data) { setGoals((current) => [...current, data as Goal]); setModal(null); notify('Savings goal created.'); } else notify(error?.message ?? 'Could not create goal.', 'error'); };
  const updateGoal = async (id: string, event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = { name: String(form.get('name')), target_amount: Number(form.get('target_amount')), current_amount: Number(form.get('current_amount') ?? 0), target_date: String(form.get('target_date')) };
    const { data, error } = await supabase.from('wallet_goals').update(payload).eq('id', id).select().maybeSingle();
    if (error || !data) { notify(error?.message ?? 'Could not update goal.', 'error'); return; }
    setGoals((current) => current.map((item) => item.id === id ? (data as Goal) : item));
    setModal(null); setEditingGoal(null); notify('Savings goal updated.');
  };
  const deleteGoal = async (id: string) => {
    // Burahin muna ang mga transaction na naka-link sa goal na ito bago ang
    // goal mismo, para hindi na rin sila makita sa Transactions list.
    const { error: transactionsError } = await supabase.from('wallet_transactions').delete().eq('goal_id', id);
    if (transactionsError) { notify(transactionsError.message ?? 'Could not remove linked transactions.', 'error'); return; }
    const { error } = await supabase.from('wallet_goals').delete().eq('id', id);
    if (error) { notify(error.message ?? 'Could not delete goal.', 'error'); return; }
    setGoals((current) => current.filter((item) => item.id !== id));
    setTransactions((current) => current.filter((item) => item.goal_id !== id));
    notify('Savings goal and its transactions were removed.');
  };
  // Step 1: form submit lang ito — nagbi-build ng payload at ise-save bilang
  // "pending" sa database (hindi pa totoong transaction). Sarado agad ang
  // modal; ang confirmation ay mangyayari sa Pending Salary panel sa gilid,
  // kung kailan talaga dumating ang sahod.
  const addSalary = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const amount = Number(form.get('amount'));
    const category = String(form.get('category') || 'Salary');
    const cutoff = String(form.get('cutoff'));
    const accountId = String(form.get('account_id'));
    const month = String(form.get('month'));
    const [year, monthNumber] = month.split('-').map(Number);
    const lastDay = new Date(year, monthNumber, 0).getDate();
    const dates = cutoff === 'first' ? [15] : cutoff === 'second' ? [lastDay] : [15, lastDay];
    const payload = dates.map((day) => ({ type: 'income' as const, amount, category, description: `${category} · ${day === 15 ? '1–15' : '16–end'}`, account_id: accountId, transaction_date: `${month}-${String(day).padStart(2, '0')}`, recurring: false, user_id: user!.id }));
    const { data, error } = await supabase.from('wallet_pending_salary').insert({ payload, cutoff, user_id: user!.id }).select().maybeSingle();
    if (error || !data) { notify(error?.message ?? 'Could not save salary.', 'error'); return; }
    setPendingSalaries((current) => [...current, data as PendingSalary]);
    setModal(null);
    notify('Salary added to Pending Salary — confirm it once it actually arrives.');
  };

  // Step 2: tatawagin ito sa Pending Salary panel kapag pinindot ang "Confirm".
  // Dito lang talaga nagiging totoong transaction ang entry.
  const confirmPendingSalary = async (pending: PendingSalary) => {
    const { data, error } = await supabase.from('wallet_transactions').insert(pending.payload).select();
    if (error || !data || data.length !== pending.payload.length) { notify(error?.message ?? 'Could not confirm salary.', 'error'); return; }
    const { error: deleteError } = await supabase.from('wallet_pending_salary').delete().eq('id', pending.id);
    if (deleteError) { notify(deleteError.message, 'error'); return; }
    setTransactions((current) => [...(data as Transaction[]).reverse(), ...current]);
    setPendingSalaries((current) => current.filter((item) => item.id !== pending.id));
    notify(pending.cutoff === 'both' ? 'Both salary cutoffs were added.' : 'Salary income added.');
  };

  // Discard: tatanggalin lang sa Pending Salary list, walang idadagdag na transaction.
  const discardPendingSalary = async (pending: PendingSalary) => {
    const { error } = await supabase.from('wallet_pending_salary').delete().eq('id', pending.id);
    if (error) { notify(error.message, 'error'); return; }
    setPendingSalaries((current) => current.filter((item) => item.id !== pending.id));
    notify('Pending salary discarded.');
  };
  const addWallet = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const { data, error } = await supabase.from('wallet_accounts').insert({ name: String(form.get('name')), type: String(form.get('type')), opening_balance: Number(form.get('opening_balance') ?? 0), color: accountColors[accounts.length % accountColors.length], user_id: user!.id }).select().maybeSingle();
    if (!error && data) { setAccounts((current) => [...current, data as Account]); setModal(null); notify('Wallet created.'); } else notify(error?.message ?? 'Could not create wallet.', 'error');
  };
  const updateWallet = async (id: string, event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = { name: String(form.get('name')), type: String(form.get('type')), opening_balance: Number(form.get('opening_balance') ?? 0) };
    const { data, error } = await supabase.from('wallet_accounts').update(payload).eq('id', id).select().maybeSingle();
    if (error || !data) { notify(error?.message ?? 'Could not update wallet.', 'error'); return; }
    setAccounts((current) => current.map((item) => item.id === id ? (data as Account) : item));
    setModal(null); setEditingWallet(null); notify('Wallet updated.');
  };
  const deleteWallet = async (id: string) => {
    const { error } = await supabase.from('wallet_accounts').delete().eq('id', id);
    if (error) { notify('Could not delete wallet.', 'error'); return; }
    setAccounts((current) => current.filter((a) => a.id !== id));
    setTransactions((current) => current.map((t) => t.account_id === id ? { ...t, account_id: null } : t));
    notify('Wallet removed.');
  };
  const exportCsv = () => {
    if (transactions.length === 0) { notify('No transactions to export.', 'error'); return; }
    const csv = ['Date,Type,Category,Description,Amount', ...transactions.map((item) => `${item.transaction_date},${item.type},${item.category},"${item.description}",${item.amount}`)].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'wallet-transactions.csv'; anchor.click(); URL.revokeObjectURL(url);
  };

  // Bumubuo ng plain-text na Statement of Account / Monthly Finance Report
  // para sa kasalukuyang buwan, gamit ang totals, category breakdown, at
  // listahan ng mga transaction. Ginagamit ito bilang katawan ng email.
  const buildStatementOfAccount = () => {
    const monthLabel = `${monthName} ${new Date().getFullYear()}`;
    const walletLines = accounts.map((account) => {
      const accountTx = currentMonthTransactions.filter((t) => t.account_id === account.id);
      const net = accountTx.reduce((sum, t) => sum + (t.type === 'income' ? Number(t.amount) : -Number(t.amount)), 0);
      return `  - ${account.name} (${account.type}): opening ${peso(Number(account.opening_balance))}, net this month ${net >= 0 ? '+' : ''}${peso(net)}`;
    });
    const categoryLines = spendingByCategory.slice(0, 8).map((item) => `  - ${item.category}: ${peso(item.amount)}`);
    const txLines = currentMonthTransactions
      .slice()
      .sort((a, b) => a.transaction_date.localeCompare(b.transaction_date))
      .map((item) => `  ${item.transaction_date}  ${item.type.padEnd(8)}  ${item.category.padEnd(14)}  ${(item.type === 'income' ? '+' : '-')}${peso(Number(item.amount))}  ${item.description}`);

    return [
      `STATEMENT OF ACCOUNT — ${monthLabel}`,
      `Prepared for: ${greetingName} (${user?.email ?? ''})`,
      `Generated: ${today}`,
      '',
      'SUMMARY',
      `  Total income:    ${peso(totals.income)}`,
      `  Total expenses:  ${peso(totals.expenses)}`,
      `  Total savings:   ${peso(totals.savings)}`,
      `  Net balance:     ${peso(totals.balance)}`,
      `  Monthly budget:  ${peso(settings.monthly_budget)}`,
      `  Financial health score: ${healthScore}/100`,
      '',
      'WALLETS',
      ...(walletLines.length ? walletLines : ['  No wallets yet.']),
      '',
      'TOP SPENDING CATEGORIES',
      ...(categoryLines.length ? categoryLines : ['  No expenses recorded this month.']),
      '',
      `TRANSACTIONS THIS MONTH (${currentMonthTransactions.length})`,
      ...(txLines.length ? txLines : ['  No transactions recorded this month.']),
      '',
      'This statement was generated automatically by pocketwise.',
    ].join('\n');
  };

  const sendReportEmail = (recipient: string) => {
    const monthLabel = `${monthName} ${new Date().getFullYear()}`;
    const subject = `Statement of Account — ${monthLabel}`;
    const body = buildStatementOfAccount();
    const mailtoUrl = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;
    setEmailModalOpen(false);
    notify('Your email app should now open with the report ready to send.');
  };

  const navItems: { id: Tab; label: string; icon: typeof Settings }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'transactions', label: 'Transactions', icon: ArrowUpRight },
    { id: 'budget', label: 'Budget', icon: BarChart3 },
    { id: 'savings', label: 'Savings goals', icon: Target },
    { id: 'wallets', label: 'Wallets', icon: WalletCards },
    { id: 'reports', label: 'Reports', icon: TrendingUp },
  ];

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
      <div className="brand"><div className="brand-mark"><WalletCards size={21} /></div><div><strong>pocketwise</strong><span>personal finance</span></div><button className="close-mobile" onClick={() => setMobileNav(false)}><X size={18} /></button></div>
      <div className="workspace-label">YOUR WORKSPACE</div>
      <nav>{navItems.map(({ id, label, icon: Icon }) => <button key={id} className={tab === id ? 'nav-item active' : 'nav-item'} onClick={() => { setTab(id); setMobileNav(false); }}><Icon size={18} /><span>{label}</span>{id === 'overview' && <span className="nav-dot" />}</button>)}</nav>
      <div className="sidebar-bottom"><div className="workspace-card"><div className="avatar">{initials}</div><div><strong>{greetingName}</strong><span>{user?.email}</span></div><ChevronDown size={15} /></div><button className="nav-item" onClick={() => void signOut()}><LogOut size={18} /><span>Sign out</span></button><div className="safe-note"><ShieldCheck size={17} /><span>Your data is kept safe and private.</span></div></div>
    </aside>
    {mobileNav && <button className="mobile-scrim" onClick={() => setMobileNav(false)} aria-label="Close navigation" />}
    <main className="main-content">
      <header className="topbar"><button className="mobile-menu" onClick={() => setMobileNav(true)}><Menu size={20} /></button><div className="breadcrumb"><span>Workspace</span><span>/</span><strong>{navItems.find((item) => item.id === tab)?.label}</strong></div><div className="top-actions"><button className="icon-button"><Bell size={18} /><i /></button><div className="top-avatar">{initials}</div></div></header>
      <div className="page-content">
        {loading ? <div className="loading-state"><RefreshCcw className="spin" size={22} /> Loading your wallet...</div> : <>
          {tab === 'overview' && <Overview totals={totals} spendingByCategory={spendingByCategory} goals={goals} transactions={transactions} accounts={accounts} healthScore={healthScore} onAdd={(type) => openAddModal(type)} onSalary={() => openAddModal('salary')} pendingSalaries={pendingSalaries} pendingSalaryOpen={pendingSalaryOpen} onTogglePendingSalary={() => setPendingSalaryOpen((value) => !value)} onConfirmPendingSalary={confirmPendingSalary} onDiscardPendingSalary={discardPendingSalary} greetingName={greetingName} monthlyData={monthlyData} monthlyBudget={settings.monthly_budget} />}
          {tab === 'transactions' && <Transactions transactions={filteredTransactions} accounts={accounts} search={search} setSearch={setSearch} onAdd={() => openAddModal('expense')} onSalary={() => openAddModal('salary')} onEdit={(item) => { setEditingTransaction(item); setModal(item.type); }} onDelete={deleteTransaction} onExport={exportCsv} hasWallets={accounts.length > 0} />}
          {tab === 'budget' && <Budget totals={totals} settings={settings} spendingByCategory={spendingByCategory} budgetHistory={budgetHistory} onSave={async (categoryBudgets, total) => { const next = { ...settings, monthly_budget: total, category_budgets: categoryBudgets }; await supabase.from('wallet_settings').upsert(next); setSettings(next); notify('Budget updated.'); }} />}
          {tab === 'savings' && <Savings goals={goals} totals={totals} onAdd={() => openAddModal('goal')} onEdit={(goal) => { setEditingGoal(goal); setModal('goal'); }} onDelete={deleteGoal} />}
          {tab === 'wallets' && <Wallets accounts={accounts} transactions={transactions} onAdd={() => openAddModal('wallet')} onEdit={(account) => { setEditingWallet(account); setModal('wallet'); }} onDelete={deleteWallet} />}
          {tab === 'reports' && <Reports totals={totals} spendingByCategory={spendingByCategory} transactions={transactions} healthScore={healthScore} monthlyData={monthlyData} onEmailReport={() => setEmailModalOpen(true)} />}
        </>}
      </div>
    </main>
    {notice && <div className={`toast ${noticeType}`}><Sparkles size={16} />{notice}</div>}
    {modal && <Modal
      type={modal}
      accounts={accounts}
      goals={goals}
      editTransaction={editingTransaction}
      editWallet={editingWallet}
      editGoal={editingGoal}
      onClose={() => { setModal(null); setEditingTransaction(null); setEditingWallet(null); setEditingGoal(null); }}
      onSubmit={
        modal === 'goal' ? (editingGoal ? (event) => updateGoal(editingGoal.id, event) : addGoal)
        : modal === 'wallet' ? (editingWallet ? (event) => updateWallet(editingWallet.id, event) : addWallet)
        : modal === 'salary' ? addSalary
        : (editingTransaction ? (event) => updateTransaction(editingTransaction.id, event) : addTransaction)
      }
    />}
    {emailModalOpen && <EmailReportModal defaultEmail={user?.email ?? ''} onClose={() => setEmailModalOpen(false)} onSend={sendReportEmail} />}
  </div>;
}

function EmailReportModal({ defaultEmail, onClose, onSend }: { defaultEmail: string; onClose: () => void; onSend: (email: string) => void }) {
  const [email, setEmail] = useState(defaultEmail);
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" onMouseDown={(event) => event.stopPropagation()}>
    <div className="modal-heading"><div><div className="eyebrow">MONTHLY REPORT</div><h2>Email statement of account</h2></div><button className="close-button" onClick={onClose}><X size={18} /></button></div>
    <form onSubmit={(event) => { event.preventDefault(); if (email) onSend(email); }}>
      <label>Send to<input type="email" name="recipient" placeholder="you@email.com" value={email} onChange={(event) => setEmail(event.target.value)} required autoFocus /></label>
      <p className="muted-hint">Bubuksan nito ang iyong email app na may kasamang buod ng income, expenses, savings, at listahan ng transactions para sa buwang ito — handa nang i-send.</p>
      <button className="primary-button modal-submit" type="submit"><Send size={16} /> Open email draft</button>
    </form>
  </div></div>;
}

function EmptyState({ icon: Icon, title, subtitle, action }: { icon: typeof Target; title: string; subtitle: string; action?: ReactNode }) {
  return <div className="empty-state-card"><div className="empty-icon"><Icon size={28} /></div><h3>{title}</h3><p>{subtitle}</p>{action}</div>;
}

function PageIntro({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle: string; action?: ReactNode }) { return <div className="page-intro"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>; }
function StatCard({ label, value, helper, icon: Icon, tone }: { label: string; value: string; helper: string; icon: typeof WalletCards; tone: string }) { return <div className={`stat-card ${tone}`}><div className="stat-top"><span>{label}</span><div className="stat-icon"><Icon size={18} /></div></div><strong>{value}</strong><div className="stat-helper">{helper}</div></div>; }

function Overview({ totals, spendingByCategory, goals, transactions, accounts, healthScore, onAdd, onSalary, pendingSalaries, pendingSalaryOpen, onTogglePendingSalary, onConfirmPendingSalary, onDiscardPendingSalary, greetingName, monthlyData, monthlyBudget }: { totals: { income: number; expenses: number; savings: number; goalSavings: number; balance: number; available: number }; spendingByCategory: { category: string; amount: number }[]; goals: Goal[]; transactions: Transaction[]; accounts: Account[]; healthScore: number; onAdd: (type: TransactionType) => void; onSalary: () => void; pendingSalaries: PendingSalary[]; pendingSalaryOpen: boolean; onTogglePendingSalary: () => void; onConfirmPendingSalary: (pending: PendingSalary) => void; onDiscardPendingSalary: (pending: PendingSalary) => void; greetingName: string; monthlyData: { label: string; income: number; expenses: number }[]; monthlyBudget: number }) {
  const maxVal = Math.max(...monthlyData.map((m) => Math.max(m.income, m.expenses)), 1);
  const donutSegments = useMemo(() => {
    const total = totals.expenses || 1;
    let acc = 0;
    return spendingByCategory.slice(0, 5).map((item, i) => {
      const pct = item.amount / total * 100;
      const seg = { color: donutColors[i % donutColors.length], label: item.category, pct, start: acc, end: acc + pct };
      acc += pct;
      return seg;
    });
  }, [spendingByCategory, totals.expenses]);
  const donutGradient = donutSegments.length > 0 ? `conic-gradient(${donutSegments.map((s) => `${s.color} ${s.start}deg ${s.end}deg`).join(', ')})` : 'conic-gradient(#e2e8f0 0 360deg)';
  const hasWallets = accounts.length > 0;

  return <>
    <PageIntro eyebrow={`${monthName} ${new Date().getFullYear()}`} title={`Welcome, ${greetingName}.`} subtitle={hasWallets ? "Here's your financial snapshot for this month." : 'Start by adding a wallet to track your finances.'} action={hasWallets ? <div className="overview-actions">
      {pendingSalaries.length > 0 && <PendingSalaryPanel pendingSalaries={pendingSalaries} accounts={accounts} open={pendingSalaryOpen} onToggle={onTogglePendingSalary} onConfirm={onConfirmPendingSalary} onDiscard={onDiscardPendingSalary} />}
      <button className="outline-button" onClick={onSalary}><CalendarDays size={16} /> Add salary</button>
      <button className="primary-button" onClick={() => onAdd('expense')}><Plus size={17} /> Add transaction</button>
    </div> : undefined} />
    <div className="stat-grid">
      <StatCard label="Total balance" value={peso(totals.balance)} helper="Across all wallets" icon={WalletCards} tone="green" />
      <StatCard label="Income this month" value={peso(totals.income)} helper="This month's earnings" icon={ArrowDownLeft} tone="blue" />
      <StatCard label="Spent this month" value={peso(totals.expenses)} helper={`${Math.round(totals.expenses / Math.max(1, monthlyBudget) * 100)}% of monthly budget`} icon={ArrowUpRight} tone="coral" />
      <StatCard label="Savings this month" value={peso(totals.goalSavings)} helper={`${totals.income > 0 ? Math.round(totals.goalSavings / totals.income * 100) : 0}% savings rate`} icon={Target} tone="gold" />
    </div>
    {hasWallets ? <>
      <div className="dashboard-grid">
        <section className="panel chart-panel">
          <div className="panel-heading"><div><h2>Cash flow</h2><p>Income vs. expenses over the last 6 months</p></div></div>
          <div className="bar-chart">
            {monthlyData.map((m) => <div className="bar-group" key={m.label}>
              <div className="bars">
                <div className="bar bar-income" style={{ height: `${Math.max(2, m.income / maxVal * 100)}%` }}><span>{m.income > 0 ? peso(m.income) : ''}</span></div>
                <div className="bar bar-expense" style={{ height: `${Math.max(2, m.expenses / maxVal * 100)}%` }}><span>{m.expenses > 0 ? peso(m.expenses) : ''}</span></div>
              </div>
              <span className="bar-label">{m.label}</span>
            </div>)}
          </div>
          <div className="chart-legend"><span><i className="legend-income" /> Income</span><span><i className="legend-expense" /> Expenses</span></div>
        </section>
        <section className="panel spending-panel">
          <div className="panel-heading"><div><h2>Spending breakdown</h2><p>Where your money goes</p></div></div>
          {spendingByCategory.length > 0 ? <><div className="donut-wrap"><div className="donut" style={{ background: donutGradient }}><div><strong>{peso(totals.expenses)}</strong><span>Total spent</span></div></div><div className="donut-legend">{donutSegments.map((seg) => <div key={seg.label}><i style={{ background: seg.color }} /><span>{seg.label}</span><strong>{Math.round(seg.pct)}%</strong></div>)}</div></div></> : <div className="inline-empty"><BarChart3 size={24} /><p>No expenses tracked yet this month.</p></div>}
        </section>
        <section className="panel goals-panel">
          <div className="panel-heading"><div><h2>Savings goals</h2><p>Small steps, big wins</p></div></div>
          {goals.length > 0 ? <div className="goals-list">{goals.slice(0, 2).map((goal) => <div className="goal-row" key={goal.id}><div className="goal-icon" style={{ background: `${goal.color}18`, color: goal.color }}><Target size={18} /></div><div className="goal-main"><div className="goal-title"><strong>{goal.name}</strong><span>{Math.round(goal.current_amount / goal.target_amount * 100)}%</span></div><div className="progress"><i style={{ width: `${Math.min(100, goal.current_amount / goal.target_amount * 100)}%`, background: goal.color }} /></div><small>{peso(goal.current_amount)} <span>of {peso(goal.target_amount)}</span></small></div></div>)}</div> : <div className="inline-empty"><Target size={24} /><p>No goals yet. Create one to start saving.</p></div>}
        </section>
        <section className="panel health-panel">
          <div className="panel-heading"><div><h2>Financial health</h2><p>Your money wellness score</p></div><span className="health-badge">{healthScore >= 70 ? 'Good' : healthScore >= 40 ? 'Fair' : 'Needs work'}</span></div>
          <div className="health-score"><div className="score-ring" style={{ '--score': `${healthScore * 3.6}deg` } as CSSProperties}><strong>{healthScore}</strong><span>/100</span></div><div><strong>{healthScore >= 70 ? "You're doing well." : healthScore >= 40 ? 'Room to improve.' : 'Time to take action.'}</strong><p>{healthScore >= 70 ? 'Keep your spending below budget to maintain your score.' : 'Track expenses and set a budget to improve your financial health.'}</p></div></div>
          <div className="health-items"><span><i />Savings rate <strong>{totals.income > 0 ? Math.round(totals.goalSavings / totals.income * 100) : 0}%</strong></span><span><i />Budget used <strong>{Math.round(totals.expenses / Math.max(1, monthlyBudget) * 100)}%</strong></span></div>
        </section>
      </div>
      {transactions.length > 0 && <section className="panel activity-panel"><div className="panel-heading"><div><h2>Recent activity</h2><p>Your latest transactions</p></div></div><div className="activity-list">{transactions.slice(0, 5).map((item) => { const account = accounts.find((a) => a.id === item.account_id); return <div className="activity-row" key={item.id}><div className={`activity-icon ${item.type}`}>{item.type === 'income' ? <ArrowDownLeft size={17} /> : item.type === 'savings' ? <Target size={17} /> : <ArrowUpRight size={17} />}</div><div className="activity-name"><strong>{item.description}</strong><span>{item.category} · {account?.name ?? 'Wallet'}</span></div><time>{item.transaction_date === today ? 'Today' : item.transaction_date}</time><strong className={item.type === 'income' ? 'amount-positive' : 'amount-negative'}>{item.type === 'income' ? '+' : '-'}{peso(Number(item.amount))}</strong></div> })}</div></section>}
    </> : <div className="big-empty"><EmptyState icon={WalletCards} title="Your dashboard is ready" subtitle="Add a wallet to start tracking your income, expenses, and savings. Everything will appear here automatically." /></div>}
  </>;
}

function Transactions({ transactions, accounts, search, setSearch, onAdd, onSalary, onEdit, onDelete, onExport, hasWallets }: { transactions: Transaction[]; accounts: Account[]; search: string; setSearch: (value: string) => void; onAdd: () => void; onSalary: () => void; onEdit: (item: Transaction) => void; onDelete: (id: string) => void; onExport: () => void; hasWallets: boolean }) {
  return <><PageIntro eyebrow="Your money history" title="Transactions" subtitle="Every peso, accounted for." action={hasWallets ? <div className="page-actions"><button className="outline-button" onClick={onSalary}><CalendarDays size={16} /> Add salary</button><button className="primary-button" onClick={onAdd}><Plus size={17} /> Add expense</button></div> : undefined} />
    {transactions.length === 0 && !search ? <div className="big-empty"><EmptyState icon={ArrowUpRight} title="No transactions yet" subtitle="Once you add income, expenses, or savings, they'll all show up here in a clean, searchable list." action={hasWallets ? <button className="primary-button" onClick={onAdd}><Plus size={17} /> Add transaction</button> : <p className="muted-hint">Create a wallet first to start adding transactions.</p>} /></div> :
    <section className="panel transactions-panel"><div className="toolbar"><label className="search-box"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search transactions..." /></label><button className="outline-button" onClick={onExport}><Download size={16} /> Export CSV</button></div><div className="table-wrap"><table><thead><tr><th>Date</th><th>Transaction</th><th>Category</th><th>Wallet</th><th>Amount</th><th /></tr></thead><tbody>{transactions.map((item) => <tr key={item.id}><td>{item.transaction_date}</td><td><div className="table-name"><div className={`mini-icon ${item.type}`} /> <strong>{item.description}</strong></div></td><td><span className="category-pill">{item.category}</span></td><td>{accounts.find((account) => account.id === item.account_id)?.name ?? '—'}</td><td className={item.type === 'income' ? 'amount-positive' : 'amount-negative'}>{item.type === 'income' ? '+' : '-'}{peso(Number(item.amount))}</td><td><div className="row-actions"><button className="edit-button" onClick={() => onEdit(item)} aria-label="Edit transaction"><Pencil size={15} /></button><button className="delete-button" onClick={() => onDelete(item.id)} aria-label="Delete transaction"><Trash2 size={16} /></button></div></td></tr>)}</tbody></table>{transactions.length === 0 && <div className="empty-state">No transactions match your search.</div>}</div></section>}
  </>;
}

function Budget({ totals, settings, spendingByCategory, budgetHistory, onSave }: { totals: { expenses: number; income: number }; settings: Settings; spendingByCategory: { category: string; amount: number }[]; budgetHistory: BudgetHistoryEntry[]; onSave: (categoryBudgets: Record<string, number>, total: number) => void }) {
  const [catBudgets, setCatBudgets] = useState<Record<string, number>>(settings.category_budgets ?? {});
  const expenseCategories = categories.filter((c) => !['Salary', 'Freelance', 'Savings'].includes(c));
  const getCap = (cat: string) => catBudgets[cat] ?? 0;
  // Ang September (o kasalukuyang buwan) total budget ay awtomatikong kabuuan
  // ng lahat ng category card sa ibaba — hindi na ito hiwalay na inilalagay.
  const totalCatBudget = expenseCategories.reduce((sum, cat) => sum + getCap(cat), 0);
  return <><PageIntro eyebrow="Plan with intention" title="Monthly budget" subtitle="Give every peso a purpose." action={<button className="primary-button" onClick={() => onSave(catBudgets, totalCatBudget)}>Save budget</button>} /><div className="budget-layout"><section className="panel budget-main"><div className="panel-heading"><div><h2>{monthName} budget</h2><p>Track your spending against your monthly plan.</p></div></div><div className="budget-total"><strong>{peso(totals.expenses)}</strong><span>of {peso(totalCatBudget)} used</span><div className="big-progress"><i style={{ width: `${Math.min(100, totals.expenses / Math.max(1, totalCatBudget) * 100)}%` }} /></div><div className="budget-foot"><span>{Math.round(totals.expenses / Math.max(1, totalCatBudget) * 100)}% used</span><span className="amount-positive">{peso(Math.max(0, totalCatBudget - totals.expenses))} remaining</span></div></div>
  <div className="budget-allocation"><div className="eyebrow">{monthName.toUpperCase()} TOTAL BUDGET</div><div className="allocation-row"><span>Sum of category cards</span><strong>{peso(totalCatBudget)}</strong></div></div>
  </section><section className="panel"><div className="panel-heading"><div><h2>Category budgets</h2><p>Bawat category may sariling card — ang ilalagay dito ay awtomatikong idadagdag sa {monthName} total budget sa itaas.</p></div></div><div className="category-budget-list">{expenseCategories.map((category) => { const spent = spendingByCategory.find((item) => item.category === category)?.amount ?? 0; const cap = getCap(category); const pct = cap > 0 ? Math.min(100, spent / cap * 100) : 0; const over = cap > 0 && spent > cap; return <div className="category-budget" key={category}><div className="cat-budget-head"><strong>{category}</strong><div className="cat-budget-input"><span>₱</span><input type="number" min="0" step="100" value={cap || ''} placeholder="0" onChange={(e) => setCatBudgets((prev) => ({ ...prev, [category]: Number(e.target.value) || 0 }))} /></div></div><div className="cat-budget-spent"><span className={over ? 'amount-negative' : 'amount-positive'}>Spent: {peso(spent)}</span><span className="muted-hint">{cap > 0 ? `${Math.round(pct)}% used` : 'No limit set'}</span></div><div className="progress"><i style={{ width: `${pct}%`, background: over ? '#e11d48' : '#0284c7' }} /></div></div> })}</div></section></div>
  {budgetHistory.length > 0 && <section className="panel budget-history-panel"><div className="panel-heading"><div><h2>Budget history</h2><p>Mga nakaraang buwan — budget kumpara sa aktwal na nagastos, para ma-track ang expenses sa paglipas ng panahon.</p></div></div><div className="budget-history-list">{budgetHistory.map((entry) => { const over = entry.total_spent > entry.monthly_budget; const label = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(`${entry.month}-02`)); const pct = entry.monthly_budget > 0 ? Math.min(100, entry.total_spent / entry.monthly_budget * 100) : 0; return <div className="budget-history-row" key={entry.id}><div className="budget-history-top"><strong>{label}</strong><span className={`history-badge ${over ? 'over' : 'under'}`}>{over ? 'Over budget' : 'Within budget'}</span></div><div className="budget-history-figures"><span>Budget: <strong>{peso(entry.monthly_budget)}</strong></span><span>Spent: <strong className={over ? 'amount-negative' : 'amount-positive'}>{peso(entry.total_spent)}</strong></span></div><div className="progress"><i style={{ width: `${pct}%`, background: over ? '#e11d48' : '#0284c7' }} /></div></div> })}</div></section>}
  </>;
}

function Savings({ goals, totals, onAdd, onEdit, onDelete }: { goals: Goal[]; totals: { goalSavings: number; income: number }; onAdd: () => void; onEdit: (goal: Goal) => void; onDelete: (id: string) => void }) {
  const savingsRate = totals.income > 0 ? Math.round(totals.goalSavings / totals.income * 100) : 0;
  return <><PageIntro eyebrow="Build your future" title="Savings goals" subtitle="Turn your plans into progress." action={<button className="primary-button" onClick={onAdd}><Plus size={17} /> New goal</button>} />
    <div className="saving-summary">
      <div className="panel saving-highlight"><div className="eyebrow">THIS MONTH</div><strong>{peso(totals.goalSavings)}</strong><span>saved so far</span><div className="saving-wave"><span /><span /><span /><span /><span /><span /></div></div>
      <div className="panel"><div className="eyebrow">SAVINGS RATE</div><strong className="summary-number">{savingsRate}%</strong><p>Target is 20%. {savingsRate >= 20 ? 'You\'re building a healthy habit.' : 'Keep going to reach your target.'}</p><div className="progress"><i style={{ width: `${Math.min(100, totals.goalSavings / Math.max(1, totals.income * .2) * 100)}%` }} /></div></div>
      <div className="panel"><div className="eyebrow">ACTIVE GOALS</div><strong className="summary-number">{goals.length}</strong><p>{goals.length > 0 ? 'Keep the momentum going.' : 'Create your first goal.'}</p></div>
    </div>
    {goals.length > 0 ? <div className="goal-cards">{goals.map((goal) => <div className="panel goal-card" key={goal.id}><div className="goal-card-top"><div className="goal-icon" style={{ background: `${goal.color}18`, color: goal.color }}><Target size={20} /></div><div className="row-actions"><button className="edit-button" onClick={() => onEdit(goal)} aria-label="Edit goal"><Pencil size={15} /></button><button className="delete-button" onClick={() => onDelete(goal.id)} aria-label="Delete goal"><Trash2 size={15} /></button></div></div><h2>{goal.name}</h2><p>Target date {goal.target_date ?? '—'}</p><div className="goal-amount"><strong>{peso(goal.current_amount)}</strong><span>of {peso(goal.target_amount)}</span></div><div className="progress"><i style={{ width: `${Math.min(100, goal.current_amount / goal.target_amount * 100)}%`, background: goal.color }} /></div><div className="goal-card-foot"><span>{Math.round(goal.current_amount / goal.target_amount * 100)}% complete</span><strong>{peso(Math.max(0, goal.target_amount - goal.current_amount))} to go</strong></div></div>)}</div> : <div className="big-empty"><EmptyState icon={Target} title="No savings goals yet" subtitle="Create a goal like 'Emergency fund' or 'New laptop' to start tracking your progress toward what matters." action={<button className="primary-button" onClick={onAdd}><Plus size={17} /> Create goal</button>} /></div>}
  </>;
}

function Wallets({ accounts, transactions, onAdd, onEdit, onDelete }: { accounts: Account[]; transactions: Transaction[]; onAdd: () => void; onEdit: (account: Account) => void; onDelete: (id: string) => void }) {
  const accountTypeIcon: Record<string, typeof WalletCards> = { 'Bank account': Landmark, Cash: CreditCard, Savings: WalletCards, 'Credit card': CreditCard };
  return <><PageIntro eyebrow="Your accounts" title="Wallets" subtitle="Manage your cash, bank, and savings accounts." action={<button className="primary-button" onClick={onAdd}><Plus size={17} /> Add wallet</button>} />
    {accounts.length > 0 ? <div className="wallet-grid">{accounts.map((account) => {
      const Icon = accountTypeIcon[account.type] ?? WalletCards;
      const accTransactions = transactions.filter((t) => t.account_id === account.id);
      const income = accTransactions.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
      const expenses = accTransactions.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
      const savings = accTransactions.filter((t) => t.type === 'savings').reduce((s, t) => s + Number(t.amount), 0);
      // Savings deducted here too, same reasoning as the overall total balance.
      const balance = Number(account.opening_balance) + income - expenses - savings;
      return <div className="wallet-card" key={account.id} style={{ '--wallet-color': displayColor(account.color) } as CSSProperties}>
        <div className="wallet-card-top"><div className="wallet-card-icon"><Icon size={20} /></div><div className="row-actions"><button className="edit-button" onClick={() => onEdit(account)} aria-label="Edit wallet"><Pencil size={15} /></button><button className="delete-button" onClick={() => onDelete(account.id)} aria-label="Delete wallet"><Trash2 size={15} /></button></div></div>
        <strong>{account.name}</strong><span className="wallet-type">{account.type}</span>
        <div className="wallet-balance"><span>Balance</span><strong>{peso(balance)}</strong></div>
        <div className="wallet-stats"><div><span>Income</span><strong className="amount-positive">{peso(income)}</strong></div><div><span>Expenses</span><strong className="amount-negative">{peso(expenses)}</strong></div>{savings > 0 && <div><span>Savings</span><strong className="amount-positive">{peso(savings)}</strong></div>}</div>
      </div>;
    })}</div> : <div className="big-empty"><EmptyState icon={WalletCards} title="No wallets yet" subtitle="Add your first wallet — like your bank account, cash on hand, or a savings account — to start tracking transactions." action={<button className="primary-button" onClick={onAdd}><Plus size={17} /> Add your first wallet</button>} /></div>}
  </>;
}

function Reports({ totals, spendingByCategory, transactions, healthScore, monthlyData, onEmailReport }: { totals: { income: number; expenses: number; savings: number }; spendingByCategory: { category: string; amount: number }[]; transactions: Transaction[]; healthScore: number; monthlyData: { label: string; income: number; expenses: number }[]; onEmailReport: () => void }) {
  const top = spendingByCategory[0];
  const maxVal = Math.max(...monthlyData.map((m) => Math.max(m.income, m.expenses)), 1);
  return <><PageIntro eyebrow="Understand your habits" title="Reports" subtitle="A clearer picture of your financial life." action={transactions.length > 0 ? <button className="primary-button" onClick={onEmailReport}><Mail size={16} /> Email monthly report</button> : undefined} />
    {transactions.length === 0 ? <div className="big-empty"><EmptyState icon={TrendingUp} title="No data to report yet" subtitle="Add some transactions and your reports will fill in automatically with spending breakdowns, trends, and insights." /></div> : <>
      <div className="report-grid"><StatCard label="Total income" value={peso(totals.income)} helper="This month" icon={ArrowDownLeft} tone="blue" /><StatCard label="Total expenses" value={peso(totals.expenses)} helper="This month" icon={ArrowUpRight} tone="coral" /><StatCard label="Total savings" value={peso(totals.savings)} helper="This month" icon={Target} tone="green" /><StatCard label="Health score" value={`${healthScore}/100`} helper={healthScore >= 70 ? 'Good standing' : healthScore >= 40 ? 'Fair standing' : 'Needs attention'} icon={ShieldCheck} tone="gold" /></div>
      <div className="report-columns">
        <section className="panel"><div className="panel-heading"><div><h2>Top spending categories</h2><p>Where most of your expenses went</p></div></div><div className="report-bars">{spendingByCategory.map((item, index) => <div className="report-bar" key={item.category}><div><span>{item.category}</span><strong>{peso(item.amount)}</strong></div><div className="bar-track"><i style={{ width: `${Math.max(12, item.amount / Math.max(1, top?.amount ?? 1) * 100)}%`, background: donutColors[index % donutColors.length] }} /></div></div>)}</div></section>
        <section className="panel insight-panel"><div className="eyebrow">YOUR INSIGHT</div><Zap size={28} /><h2>{top ? `${top.category} is your biggest spend.` : 'Your spending story is taking shape.'}</h2><p>{top ? `You spent ${peso(top.amount)} here this month. A small adjustment could make room for your next savings goal.` : 'Add a few transactions to see personalized insights.'}</p></section>
      </div>
      <section className="panel"><div className="panel-heading"><div><h2>6-month trend</h2><p>Income vs. expenses</p></div></div><div className="bar-chart">{monthlyData.map((m) => <div className="bar-group" key={m.label}><div className="bars"><div className="bar bar-income" style={{ height: `${Math.max(2, m.income / maxVal * 100)}%` }}><span>{m.income > 0 ? peso(m.income) : ''}</span></div><div className="bar bar-expense" style={{ height: `${Math.max(2, m.expenses / maxVal * 100)}%` }}><span>{m.expenses > 0 ? peso(m.expenses) : ''}</span></div></div><span className="bar-label">{m.label}</span></div>)}</div><div className="chart-legend"><span><i className="legend-income" /> Income</span><span><i className="legend-expense" /> Expenses</span></div></section>
      <section className="panel report-note"><TrendingUp size={19} /><div><strong>{transactions.length} transactions tracked</strong><p>Your reports update automatically every time you add a transaction.</p></div></section>
    </>}
  </>;
}

function Modal({ type, accounts, goals, onClose, onSubmit, editTransaction, editWallet, editGoal }: { type: TransactionType | 'goal' | 'wallet' | 'salary'; accounts: Account[]; goals: Goal[]; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; editTransaction?: Transaction | null; editWallet?: Account | null; editGoal?: Goal | null }) {
  const isGoal = type === 'goal';
  const isWallet = type === 'wallet';
  const isSalary = type === 'salary';
  const isEdit = !!(editTransaction || editWallet || editGoal);
  const [selectedType, setSelectedType] = useState<TransactionType>(editTransaction?.type ?? (type === 'income' || type === 'expense' || type === 'savings' ? type : 'expense'));
  const title = isEdit ? (isGoal ? 'Edit savings goal' : isWallet ? 'Edit wallet' : `Edit ${selectedType}`) : isGoal ? 'Create savings goal' : isWallet ? 'Add wallet' : isSalary ? 'Add incoming salary' : `Add ${selectedType}`;
  const eyebrow = isEdit ? 'EDIT ENTRY' : isGoal ? 'PLAN AHEAD' : isWallet ? 'NEW WALLET' : isSalary ? 'PAYDAY PLANNER' : 'NEW TRANSACTION';
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" onMouseDown={(event) => event.stopPropagation()}>
    <div className="modal-heading"><div><div className="eyebrow">{eyebrow}</div><h2>{title}</h2></div><button className="close-button" onClick={onClose}><X size={18} /></button></div>
    <form onSubmit={onSubmit}>
      {isWallet ? <>
        <label>Wallet name<input name="name" placeholder="e.g. BPI Savings" defaultValue={editWallet?.name} required /></label>
        <div className="form-grid"><label>Type<select name="type" defaultValue={editWallet?.type ?? 'Bank account'}><option>Bank account</option><option>Cash</option><option>Savings</option><option>Credit card</option></select></label><label>Opening balance<input name="opening_balance" type="number" min="0" step="0.01" placeholder="0.00" defaultValue={editWallet?.opening_balance ?? 0} /></label></div>
      </> : isSalary ? <>
        <label>Salary amount per cutoff<input name="amount" type="number" min="1" step="0.01" placeholder="e.g. 15000" required autoFocus /></label>
        <div className="form-grid"><label>Category<select name="category" defaultValue="Salary">{incomeCategories.map((item) => <option key={item}>{item}</option>)}</select></label><label>Pay period<select name="cutoff" defaultValue="both"><option value="first">1–15</option><option value="second">16–end of month</option><option value="both">Both cutoffs</option></select></label></div>
        <div className="form-grid"><label>Month<input name="month" type="month" defaultValue={today.slice(0, 7)} required /></label><label>Wallet<select name="account_id" required>{accounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select></label></div>
        <p className="muted-hint">Idadagdag muna ito sa Pending Salary sa gilid. Doon mo lang ito i-co-confirm kapag talaga nang dumating ang sahod.</p>
      </> : isGoal ? <>
        <label>Goal name<input name="name" placeholder="e.g. Vacation fund" defaultValue={editGoal?.name} required /></label>
        <div className="form-grid"><label>Target amount<input name="target_amount" type="number" min="1" placeholder="50000" defaultValue={editGoal?.target_amount} required /></label><label>Already saved<input name="current_amount" type="number" min="0" placeholder="0" defaultValue={editGoal?.current_amount ?? 0} /></label></div>
        <label>Target date<input name="target_date" type="date" defaultValue={editGoal?.target_date ?? ''} required /></label>
      </> : <>
        <div className="type-switch">{(['income', 'expense', 'savings'] as TransactionType[]).map((item) => <label key={item} className={selectedType === item ? 'selected' : ''}><input type="radio" name="type" value={item} checked={selectedType === item} onChange={() => setSelectedType(item)} />{item}</label>)}</div>
        <div className="form-grid"><label>Amount<input name="amount" type="number" min="1" step="0.01" placeholder="0.00" defaultValue={editTransaction?.amount} required autoFocus /></label><label>Date<input name="transaction_date" type="date" defaultValue={editTransaction?.transaction_date ?? today} required /></label></div>
        <div className="form-grid"><label>Category<select name="category" defaultValue={editTransaction?.category ?? (type === 'income' ? 'Salary' : type === 'savings' ? 'Savings' : 'Food')}>{categoryOptions.map((item) => <option key={item}>{item}</option>)}</select></label><label>Wallet<select name="account_id" defaultValue={editTransaction?.account_id ?? ''} required>{accounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select></label></div>
        <label>Description<input name="description" placeholder="What was this for?" defaultValue={editTransaction?.description} required /></label>
        {selectedType === 'savings' && <label>Savings goal<select name="goal_id" defaultValue={editTransaction?.goal_id ?? ''}><option value="">No goal — general savings</option>{goals.map((goal) => <option value={goal.id} key={goal.id}>{goal.name}</option>)}</select><small className="muted-hint">Kapag pinili ang goal, idadagdag din dito ang amount na ito.</small></label>}
        <label className="checkbox-label"><input type="checkbox" name="recurring" defaultChecked={editTransaction?.recurring ?? false} /> Repeat this monthly</label>
      </>}
      <button className="primary-button modal-submit" type="submit">{isEdit ? 'Save changes' : isGoal ? 'Create goal' : isWallet ? 'Create wallet' : isSalary ? 'Add to pending salary' : 'Save transaction'}</button>
    </form>
  </div></div>;
}

function PendingSalaryPanel({ pendingSalaries, accounts, open, onToggle, onConfirm, onDiscard }: { pendingSalaries: PendingSalary[]; accounts: Account[]; open: boolean; onToggle: () => void; onConfirm: (pending: PendingSalary) => void; onDiscard: (pending: PendingSalary) => void }) {
  return <div className={`pending-salary-panel ${open ? 'open' : 'closed'}`}>
    <button className="pending-salary-toggle" onClick={onToggle} aria-expanded={open} aria-haspopup="true">
      <CalendarDays size={16} />
      <span>Pending Salary</span>
      <span className="pending-salary-count">{pendingSalaries.length}</span>
      <ChevronDown size={15} className="pending-salary-chevron" />
    </button>
    {open && <div className="pending-salary-list">
      {pendingSalaries.map((pending) => {
        const total = pending.payload.reduce((sum, item) => sum + Number(item.amount), 0);
        const accountName = accounts.find((account) => account.id === pending.payload[0]?.account_id)?.name ?? '—';
        return <div className="pending-salary-card" key={pending.id}>
          <div className="pending-salary-card-top"><span className="pending-salary-badge">PENDING</span><strong className="amount-positive">+{peso(total)}</strong></div>
          <div className="pending-salary-lines">{pending.payload.map((item) => <div className="pending-salary-line" key={item.transaction_date}><span>{item.description}</span><span>{item.transaction_date}</span></div>)}</div>
          <div className="pending-salary-wallet muted-hint">To {accountName}</div>
          <div className="pending-salary-actions">
            <button className="outline-button" onClick={() => onDiscard(pending)}>Discard</button>
            <button className="primary-button" onClick={() => onConfirm(pending)}>Confirm arrived</button>
          </div>
        </div>;
      })}
    </div>}
  </div>;
}

function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-state"><RefreshCcw className="spin" size={22} /> Loading...</div>;
  if (!user) return <AuthPage />;
  return <Dashboard />;
}

export default App;