import { Button } from '@/components/ui/button';
import { Globe } from 'lucide-react';

interface DirectoryPresetsProps {
  onSelectDirectory: (url: string) => void;
  disabled?: boolean;
}

const UAE_DIRECTORIES = [
  { name: 'Yello UAE', url: 'https://www.yello.ae' },
  { name: 'HiDubai', url: 'https://www.hidubai.com' },
  { name: 'Dubai Business Directory', url: 'https://dubaibusinessdirectory.ae' },
  { name: 'YellowPages UAE', url: 'https://www.yellowpages-uae.com' },
  { name: 'UAE Business Directory', url: 'https://uaebusinessdirectory.com' },
  { name: 'UAE Companies', url: 'https://www.uaecompanies.ae' },
  { name: 'GetListed UAE', url: 'https://www.getlisteduae.com' },
  { name: 'Day Of Dubai', url: 'https://www.dayofdubai.com' },
  { name: 'Enroll Business', url: 'https://www.enrollbusiness.com' },
  { name: 'Kompass UAE', url: 'https://ae.kompass.com' },
  { name: 'Zumvu', url: 'https://www.zumvu.com' },
  { name: 'Locanto UAE', url: 'https://www.locanto.ae' },
  { name: 'Araboo', url: 'https://www.araboo.com' },
  { name: 'Onmap UAE', url: 'https://www.onmap.ae' },
  { name: 'CitySearch UAE', url: 'https://www.citysearch.ae' },
  { name: 'Bizness UAE', url: 'https://www.biznessuae.com' },
  { name: 'YellowPages.ae', url: 'https://www.yellowpages.ae' },
];

export const DirectoryPresets = ({ onSelectDirectory, disabled }: DirectoryPresetsProps) => {
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground flex items-center gap-1">
        <Globe className="h-3.5 w-3.5" />
        Quick access to UAE directories:
      </p>
      <div className="flex flex-wrap gap-2">
        {UAE_DIRECTORIES.map((dir) => (
          <Button
            key={dir.url}
            variant="outline"
            size="sm"
            onClick={() => onSelectDirectory(dir.url)}
            disabled={disabled}
            className="text-xs h-7"
          >
            {dir.name}
          </Button>
        ))}
      </div>
    </div>
  );
};
