import { TransactionDetailScreen } from "@/components/screens";
import { useLocalSearchParams } from "expo-router";
import { useWallet } from "@/context/walletContext";

export default function DetailsScreen() {
  const { id } = useLocalSearchParams();
  const { transactions } = useWallet();

  // ponytail: looked up by tx hash; a payer has one funds output per tx in practice
  const transaction = transactions.find((t) => t.txHash === id);

  return <TransactionDetailScreen data={transaction} />;
}
