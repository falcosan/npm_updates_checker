const readline = require('readline');
const packageJson = require('./package.json');

const formatDate = (dateString, complete = false) => {
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${day}-${month}-${year}` + (complete ? ` - ${hours}:${minutes}` : '');
};

const getLatestUpdates = async (dependencies, updates) => {
  for (const [packageName, version] of Object.entries(dependencies)) {
    if (!updates[packageName]) {
      try {
        const response = await fetch(`https://registry.npmjs.org/${packageName}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch ${packageName}`);
        }
        const packageInfo = await response.json();
        const {
          'dist-tags': { latest },
          time
        } = packageInfo;
        const lastUpdated = time[latest];
        updates[packageName] = { currentVersion: version, latestVersion: latest, lastUpdated };
        if (packageInfo.dependencies) {
          await getLatestUpdates(packageInfo.dependencies, updates);
        }
      } catch (error) {
        console.error(`Error fetching ${packageName}: ${error.message}`);
        updates[packageName] = {
          currentVersion: version,
          latestVersion: 'error',
          lastUpdated: 'error'
        };
      }
    }
  }
  return updates;
};

const getUpdatedOnDate = (updates, date) => {
  const formattedDate = formatDate(date.toISOString());
  return Object.entries(updates).reduce((updatedOnDate, [packageName, updateInfo]) => {
    if (formatDate(updateInfo.lastUpdated) === formattedDate) {
      const formattedLastUpdated = formatDate(updateInfo.lastUpdated, true);
      updatedOnDate.push(
        `${packageName}: ${updateInfo.currentVersion} -> ${updateInfo.latestVersion} | ${formattedLastUpdated}`
      );
    }
    return updatedOnDate;
  }, []);
};

const main = () => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = "Enter the date (DD-MM-YYYY), press Enter to use today's date: ";
  rl.question(question, async dateInput => {
    rl.close();
    const today = new Date();
    const dateRegex = /^\d{2}-\d{2}-\d{4}$/;

    if (!dateInput) {
      await processDate(today);
    } else if (!dateRegex.test(dateInput)) {
      console.table('Invalid date format. Please enter a valid date (DD-MM-YYYY).');
    } else {
      const [day, month, year] = dateInput.split('-').map(Number);
      const chosenDate = new Date(year, month - 1, day);

      if (chosenDate.getTime() > today.getTime()) {
        console.table('Invalid date. Please enter a date in the past or today.');
      } else {
        await processDate(chosenDate);
      }
    }
  });

  const processDate = async chosenDate => {
    try {
      const dependencies = {
        ...(packageJson.dependencies || {}),
        ...(packageJson.devDependencies || {})
      };
      const updates = await getLatestUpdates(dependencies, {});
      const updatedOnDate = getUpdatedOnDate(updates, chosenDate);

      if (updatedOnDate.length) {
        updatedOnDate.forEach((packageInfo, index) =>
          console.table(`${index + 1}. ${packageInfo}`)
        );
      } else {
        console.table(`No packages updated on ${formatDate(chosenDate)}.`);
      }
    } catch (error) {
      console.error('An error occurred:', error);
    }
  };
};

main();
