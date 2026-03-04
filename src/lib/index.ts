import { registry } from './core/registry.svelte';
import { TotalPortfolioModule } from './modules/portfolio-manager';
import { SmartWithdrawalModule } from './modules/smart-withdrawals';
import { SocialSecurityModule } from './modules/social-security';
import { PensionModule } from './modules/pension';

// Import external modules
import { TipsLadderModule } from '@brucedarcus/tips-ladder';

// Register core modules
registry.register(TotalPortfolioModule);
registry.register(SocialSecurityModule);
registry.register(PensionModule);
registry.register(SmartWithdrawalModule);

// Register external modules
registry.register(TipsLadderModule);

export { registry };
