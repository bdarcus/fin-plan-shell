import { registry } from "./core/registry.svelte";
import { PensionModule } from "./modules/pension";
import { TotalPortfolioModule } from "./modules/portfolio-manager";
import { SmartWithdrawalModule } from "./modules/smart-withdrawals";
import { SocialSecurityModule } from "./modules/social-security";
import { TipsLadderModule } from "./modules/tips-ladder";

// Register all modules to the shell registry
registry.register(TotalPortfolioModule as any);
registry.register(SocialSecurityModule as any);
registry.register(PensionModule as any);
registry.register(TipsLadderModule as any);
registry.register(SmartWithdrawalModule as any);

export { registry };
