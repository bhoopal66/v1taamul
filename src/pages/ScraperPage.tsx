import { BusinessDirectoryScraper } from '@/components/scraper/BusinessDirectoryScraper';

const ScraperPage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Business Directory Scraper</h1>
        <p className="text-muted-foreground">
          Extract company data from online business directories and import to your contacts
        </p>
      </div>
      
      <BusinessDirectoryScraper />
    </div>
  );
};

export default ScraperPage;
