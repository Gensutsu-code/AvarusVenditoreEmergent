"""
Test suite for Personal Files Tag System and Navigation Features
Tests: Tag CRUD, filtering, search by tags, similar files endpoint
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test file IDs with known tags (from context)
FILE_WITH_TAGS_1 = "bdddade5-95ea-432d-b75b-bbb7929b494d"  # tags: [test, video, demo]
FILE_WITH_TAGS_2 = "dd417d50-1b8f-443f-b97e-6db910a664a0"  # tags: [video, sample]


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "admin@avarus.ru", "password": "admin"}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["token"]


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    """Headers with admin auth token"""
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


class TestTagsListEndpoint:
    """Tests for GET /api/personal-files/tags"""
    
    def test_list_all_tags_returns_tags_with_counts(self, auth_headers):
        """GET /api/personal-files/tags returns list of unique tags with counts"""
        response = requests.get(f"{BASE_URL}/api/personal-files/tags", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "tags" in data
        assert isinstance(data["tags"], list)
        
        # Verify tag structure
        if len(data["tags"]) > 0:
            tag = data["tags"][0]
            assert "name" in tag
            assert "count" in tag
            assert isinstance(tag["name"], str)
            assert isinstance(tag["count"], int)
            assert tag["count"] > 0
    
    def test_list_tags_includes_known_tags(self, auth_headers):
        """GET /api/personal-files/tags includes 'video' tag (known to exist)"""
        response = requests.get(f"{BASE_URL}/api/personal-files/tags", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        tag_names = [t["name"] for t in data["tags"]]
        
        # 'video' tag should exist (both test files have it)
        assert "video" in tag_names
    
    def test_list_tags_requires_auth(self):
        """GET /api/personal-files/tags requires authentication"""
        response = requests.get(f"{BASE_URL}/api/personal-files/tags")
        assert response.status_code in [401, 403]


class TestUpdateTagsEndpoint:
    """Tests for PUT /api/personal-files/files/{file_id}/tags"""
    
    def test_update_tags_success(self, auth_headers):
        """PUT /api/personal-files/files/{file_id}/tags updates tags successfully"""
        # Add a new tag
        new_tags = ["test", "video", "demo", "pytest_test_tag"]
        response = requests.put(
            f"{BASE_URL}/api/personal-files/files/{FILE_WITH_TAGS_1}/tags",
            headers=auth_headers,
            json={"tags": new_tags}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "tags" in data
        assert "pytest_test_tag" in data["tags"]
        
        # Restore original tags
        requests.put(
            f"{BASE_URL}/api/personal-files/files/{FILE_WITH_TAGS_1}/tags",
            headers=auth_headers,
            json={"tags": ["test", "video", "demo"]}
        )
    
    def test_update_tags_normalizes_to_lowercase(self, auth_headers):
        """PUT /api/personal-files/files/{file_id}/tags normalizes tags to lowercase"""
        response = requests.put(
            f"{BASE_URL}/api/personal-files/files/{FILE_WITH_TAGS_1}/tags",
            headers=auth_headers,
            json={"tags": ["TEST", "VIDEO", "Demo"]}
        )
        
        assert response.status_code == 200
        data = response.json()
        # All tags should be lowercase
        for tag in data["tags"]:
            assert tag == tag.lower()
        
        # Restore original tags
        requests.put(
            f"{BASE_URL}/api/personal-files/files/{FILE_WITH_TAGS_1}/tags",
            headers=auth_headers,
            json={"tags": ["test", "video", "demo"]}
        )
    
    def test_update_tags_removes_duplicates(self, auth_headers):
        """PUT /api/personal-files/files/{file_id}/tags removes duplicate tags"""
        response = requests.put(
            f"{BASE_URL}/api/personal-files/files/{FILE_WITH_TAGS_1}/tags",
            headers=auth_headers,
            json={"tags": ["test", "test", "video", "video", "demo"]}
        )
        
        assert response.status_code == 200
        data = response.json()
        # Should have no duplicates
        assert len(data["tags"]) == len(set(data["tags"]))
        
        # Restore original tags
        requests.put(
            f"{BASE_URL}/api/personal-files/files/{FILE_WITH_TAGS_1}/tags",
            headers=auth_headers,
            json={"tags": ["test", "video", "demo"]}
        )
    
    def test_update_tags_file_not_found(self, auth_headers):
        """PUT /api/personal-files/files/{file_id}/tags returns 404 for non-existent file"""
        response = requests.put(
            f"{BASE_URL}/api/personal-files/files/non-existent-file-id/tags",
            headers=auth_headers,
            json={"tags": ["test"]}
        )
        
        assert response.status_code == 404
        assert "not found" in response.json().get("detail", "").lower()
    
    def test_update_tags_requires_auth(self):
        """PUT /api/personal-files/files/{file_id}/tags requires authentication"""
        response = requests.put(
            f"{BASE_URL}/api/personal-files/files/{FILE_WITH_TAGS_1}/tags",
            json={"tags": ["test"]}
        )
        assert response.status_code in [401, 403]


class TestFilterByTag:
    """Tests for GET /api/personal-files/files?tag=xxx"""
    
    def test_filter_by_tag_returns_matching_files(self, auth_headers):
        """GET /api/personal-files/files?tag=video returns files with 'video' tag"""
        response = requests.get(
            f"{BASE_URL}/api/personal-files/files?tag=video",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "files" in data
        
        # All returned files should have 'video' tag
        for file in data["files"]:
            assert "tags" in file
            assert "video" in file["tags"]
    
    def test_filter_by_tag_returns_at_least_two_files(self, auth_headers):
        """GET /api/personal-files/files?tag=video returns at least 2 files (known test data)"""
        response = requests.get(
            f"{BASE_URL}/api/personal-files/files?tag=video",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["files"]) >= 2
    
    def test_filter_by_nonexistent_tag_returns_empty(self, auth_headers):
        """GET /api/personal-files/files?tag=nonexistent returns empty list"""
        response = requests.get(
            f"{BASE_URL}/api/personal-files/files?tag=nonexistent_tag_xyz",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["files"] == []


class TestSearchByTag:
    """Tests for GET /api/personal-files/files?search=xxx (searches tags too)"""
    
    def test_search_finds_files_by_tag_name(self, auth_headers):
        """GET /api/personal-files/files?search=demo finds files with 'demo' tag"""
        response = requests.get(
            f"{BASE_URL}/api/personal-files/files?search=demo",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["files"]) >= 1
        
        # At least one file should have 'demo' in tags
        found_demo_tag = False
        for file in data["files"]:
            if "demo" in (file.get("tags") or []):
                found_demo_tag = True
                break
        assert found_demo_tag, "Search should find files by tag name"
    
    def test_search_is_case_insensitive(self, auth_headers):
        """GET /api/personal-files/files?search=DEMO is case insensitive"""
        response = requests.get(
            f"{BASE_URL}/api/personal-files/files?search=DEMO",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        # Should find same results as lowercase search
        assert len(data["files"]) >= 1


class TestSimilarFilesEndpoint:
    """Tests for GET /api/personal-files/files/{file_id}/similar"""
    
    def test_similar_files_returns_files_with_shared_tags(self, auth_headers):
        """GET /api/personal-files/files/{file_id}/similar returns files with shared tags"""
        response = requests.get(
            f"{BASE_URL}/api/personal-files/files/{FILE_WITH_TAGS_1}/similar?limit=10",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "files" in data
        
        # Should return at least one similar file (FILE_WITH_TAGS_2 shares 'video' tag)
        assert len(data["files"]) >= 1
        
        # Similar files should share at least one tag
        original_tags = ["test", "video", "demo"]
        for file in data["files"]:
            file_tags = file.get("tags") or []
            shared = set(original_tags) & set(file_tags)
            assert len(shared) > 0, f"Similar file should share at least one tag"
    
    def test_similar_files_excludes_original_file(self, auth_headers):
        """GET /api/personal-files/files/{file_id}/similar excludes the original file"""
        response = requests.get(
            f"{BASE_URL}/api/personal-files/files/{FILE_WITH_TAGS_1}/similar?limit=10",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Original file should not be in results
        file_ids = [f["id"] for f in data["files"]]
        assert FILE_WITH_TAGS_1 not in file_ids
    
    def test_similar_files_respects_limit(self, auth_headers):
        """GET /api/personal-files/files/{file_id}/similar respects limit parameter"""
        response = requests.get(
            f"{BASE_URL}/api/personal-files/files/{FILE_WITH_TAGS_1}/similar?limit=1",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["files"]) <= 1
    
    def test_similar_files_file_not_found(self, auth_headers):
        """GET /api/personal-files/files/{file_id}/similar returns 404 for non-existent file"""
        response = requests.get(
            f"{BASE_URL}/api/personal-files/files/non-existent-file-id/similar",
            headers=auth_headers
        )
        
        assert response.status_code == 404
    
    def test_similar_files_requires_auth(self):
        """GET /api/personal-files/files/{file_id}/similar requires authentication"""
        response = requests.get(
            f"{BASE_URL}/api/personal-files/files/{FILE_WITH_TAGS_1}/similar"
        )
        assert response.status_code in [401, 403]


class TestTagsIntegration:
    """Integration tests for tag workflow"""
    
    def test_add_tag_then_filter_finds_file(self, auth_headers):
        """Adding a unique tag then filtering by it finds the file"""
        unique_tag = "pytest_unique_integration_test"
        
        # Add unique tag
        response = requests.put(
            f"{BASE_URL}/api/personal-files/files/{FILE_WITH_TAGS_1}/tags",
            headers=auth_headers,
            json={"tags": ["test", "video", "demo", unique_tag]}
        )
        assert response.status_code == 200
        
        # Filter by unique tag
        response = requests.get(
            f"{BASE_URL}/api/personal-files/files?tag={unique_tag}",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["files"]) == 1
        assert data["files"][0]["id"] == FILE_WITH_TAGS_1
        
        # Verify tag appears in tags list
        response = requests.get(f"{BASE_URL}/api/personal-files/tags", headers=auth_headers)
        assert response.status_code == 200
        tag_names = [t["name"] for t in response.json()["tags"]]
        assert unique_tag in tag_names
        
        # Cleanup: restore original tags
        requests.put(
            f"{BASE_URL}/api/personal-files/files/{FILE_WITH_TAGS_1}/tags",
            headers=auth_headers,
            json={"tags": ["test", "video", "demo"]}
        )
    
    def test_remove_tag_then_filter_excludes_file(self, auth_headers):
        """Removing a tag then filtering by it excludes the file"""
        # Remove 'demo' tag
        response = requests.put(
            f"{BASE_URL}/api/personal-files/files/{FILE_WITH_TAGS_1}/tags",
            headers=auth_headers,
            json={"tags": ["test", "video"]}  # removed 'demo'
        )
        assert response.status_code == 200
        
        # Filter by 'demo' - should not find FILE_WITH_TAGS_1
        response = requests.get(
            f"{BASE_URL}/api/personal-files/files?tag=demo",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        file_ids = [f["id"] for f in data["files"]]
        assert FILE_WITH_TAGS_1 not in file_ids
        
        # Cleanup: restore original tags
        requests.put(
            f"{BASE_URL}/api/personal-files/files/{FILE_WITH_TAGS_1}/tags",
            headers=auth_headers,
            json={"tags": ["test", "video", "demo"]}
        )
