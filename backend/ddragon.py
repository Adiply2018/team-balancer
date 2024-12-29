from typing import Dict, Optional

import requests


class ChampionIconGenerator:
    def __init__(self):
        self.base_url = "https://ddragon.leagueoflegends.com/cdn"
        self.latest_version = self._get_latest_version()
        self.champion_data = self._get_champion_data()

    def _get_latest_version(self) -> str:
        """Get the latest DataDragon version."""
        versions_url = "https://ddragon.leagueoflegends.com/api/versions.json"
        response = requests.get(versions_url)
        return response.json()[0]

    def _get_champion_data(self) -> Dict:
        """Get champion data from DataDragon."""
        url = f"{self.base_url}/{self.latest_version}/data/en_US/champion.json"
        response = requests.get(url)
        return response.json()["data"]

    def get_champion_id_map(self) -> Dict[int, str]:
        """Create a mapping of champion IDs to champion keys."""
        champion_map = {}
        for champion in self.champion_data.values():
            champion_map[int(champion["key"])] = champion["id"]
        return champion_map

    def get_champion_icon_url(self, champion_id: int) -> Optional[str]:
        """
        Get champion icon URL from champion ID.

        Args:
            champion_id (int): The numeric ID of the champion

        Returns:
            str: URL of the champion icon, or None if champion not found
        """
        champion_map = self.get_champion_id_map()
        if champion_id not in champion_map:
            return None

        champion_key = champion_map[champion_id]
        return f"{self.base_url}/{self.latest_version}/img/champion/{champion_key}.png"
