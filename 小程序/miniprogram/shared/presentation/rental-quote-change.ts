import { rentalMoney } from './rental-order';

type Fees = { rent_gross_fen: string; rent_discount_fen: string; deposit_due_fen: string; initial_due_fen: string };
/** The old quote remains a comparison only; a newly read quote is never accepted here. */
export function rentalQuoteChange(previous: Fees, latest: Fees | null) {
    const rows = [
        { label: '原租金', value: rentalMoney(previous.rent_gross_fen), emphasis: false },
        { label: '最新租金', value: rentalMoney(latest?.rent_gross_fen), emphasis: true },
    ];
    if (previous.deposit_due_fen === latest?.deposit_due_fen) rows.push({ label: '租赁押金', value: rentalMoney(latest.deposit_due_fen) + '（不变）', emphasis: false });
    else rows.push({ label: '原租赁押金', value: rentalMoney(previous.deposit_due_fen), emphasis: false }, { label: '最新租赁押金', value: rentalMoney(latest?.deposit_due_fen), emphasis: true });
    if (previous.rent_discount_fen !== '0' || latest?.rent_discount_fen !== '0') rows.push(
        { label: '原优惠抵扣', value: rentalMoney(previous.rent_discount_fen), emphasis: false },
        { label: '最新优惠抵扣', value: rentalMoney(latest?.rent_discount_fen), emphasis: true },
    );
    rows.push({ label: '原应付', value: rentalMoney(previous.initial_due_fen), emphasis: false }, { label: '最新应付', value: rentalMoney(latest?.initial_due_fen), emphasis: true });
    return { rows, latestKnown: !!latest };
}
