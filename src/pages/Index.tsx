import { FoosballGame } from "@/components/FoosballGame";
import { AuthWrapper } from "@/components/AuthWrapper";

const Index = () => {
  return (
    <AuthWrapper>
      <FoosballGame />
    </AuthWrapper>
  );
};

export default Index;
