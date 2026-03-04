import { registry } from "./core/registry.svelte";
import { PensionModule } from "./modules/pension";
import { TotalPortfolioModule } from "./modules/portfolio-manager";
import { SmartWithdrawalModule } from "./modules/smart-withdrawals";
import { SocialSecurityModule } from "./modules/social-security";
import { TipsLadderModule } from "./modules/tips-ladder";

// Register all modules to the shell registry
registry.register(TotalPortfolioModule);
registry.register(SocialSecurityModule);
registry.register(PensionModule);
registry.register(TipsLadderModule);
registry.register(SmartWithdrawalModule);

export { registry };
