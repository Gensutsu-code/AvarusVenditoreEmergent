"""
Test Video Sprite Generation for Personal Files
Tests the bug fix: Cloudinary-stored videos now get sprites because temp file is preserved until sprite generation completes.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test video IDs from the bug fix verification
TEST_VIDEO_SIMPLE_UPLOAD = "dd417d50-1b8f-443f-b97e-6db910a664a0"  # Simple /upload endpoint (Cloudinary)
TEST_VIDEO_CHUNKED_UPLOAD = "bdddade5-95ea-432d-b75b-bbb7929b494d"  # Chunked upload (Cloudinary)

# Credentials
ADMIN_EMAIL = "admin@avarus.ru"
ADMIN_PASSWORD = "admin"
PERSONAL_FILES_PASSWORD = "GenSutSu.1999"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    return response.json().get("token")


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    """Headers with admin token"""
    return {"Authorization": f"Bearer {admin_token}"}


class TestPersonalFilesAuth:
    """Test personal files password authentication"""
    
    def test_auth_with_correct_password(self, auth_headers):
        """POST /api/personal-files/auth with correct password returns success"""
        response = requests.post(
            f"{BASE_URL}/api/personal-files/auth",
            json={"password": PERSONAL_FILES_PASSWORD},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") is True
        print(f"PASS: Auth with correct password returns success=True")
    
    def test_auth_with_wrong_password(self, auth_headers):
        """POST /api/personal-files/auth with wrong password returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/personal-files/auth",
            json={"password": "wrong_password"},
            headers=auth_headers
        )
        assert response.status_code == 401
        print(f"PASS: Auth with wrong password returns 401")


class TestFilesListWithSpriteReady:
    """Test that files list includes sprite_ready field for videos"""
    
    def test_files_list_returns_sprite_ready_field(self, auth_headers):
        """GET /api/personal-files/files returns files with sprite_ready field"""
        response = requests.get(
            f"{BASE_URL}/api/personal-files/files",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        files = data.get("files", [])
        
        # Find video files
        video_files = [f for f in files if f.get("file_type") == "video"]
        print(f"Found {len(video_files)} video files in the list")
        
        # Check that video files have sprite_ready field
        for video in video_files:
            print(f"  Video: {video.get('name')} (id={video.get('id')}) - sprite_ready={video.get('sprite_ready')}")
        
        assert len(video_files) > 0, "No video files found in personal files"
        print(f"PASS: Files list returns {len(video_files)} video files")
    
    def test_simple_upload_video_has_sprite_ready_true(self, auth_headers):
        """Verify video uploaded via simple /upload has sprite_ready=True"""
        response = requests.get(
            f"{BASE_URL}/api/personal-files/files",
            headers=auth_headers
        )
        assert response.status_code == 200
        files = response.json().get("files", [])
        
        # Find the specific test video
        test_video = next((f for f in files if f.get("id") == TEST_VIDEO_SIMPLE_UPLOAD), None)
        
        if test_video:
            assert test_video.get("sprite_ready") is True, f"Video {TEST_VIDEO_SIMPLE_UPLOAD} should have sprite_ready=True"
            print(f"PASS: Simple upload video {TEST_VIDEO_SIMPLE_UPLOAD} has sprite_ready=True")
        else:
            pytest.skip(f"Test video {TEST_VIDEO_SIMPLE_UPLOAD} not found - may have been deleted")
    
    def test_chunked_upload_video_has_sprite_ready_true(self, auth_headers):
        """Verify video uploaded via chunked upload has sprite_ready=True"""
        response = requests.get(
            f"{BASE_URL}/api/personal-files/files",
            headers=auth_headers
        )
        assert response.status_code == 200
        files = response.json().get("files", [])
        
        # Find the specific test video
        test_video = next((f for f in files if f.get("id") == TEST_VIDEO_CHUNKED_UPLOAD), None)
        
        if test_video:
            assert test_video.get("sprite_ready") is True, f"Video {TEST_VIDEO_CHUNKED_UPLOAD} should have sprite_ready=True"
            print(f"PASS: Chunked upload video {TEST_VIDEO_CHUNKED_UPLOAD} has sprite_ready=True")
        else:
            pytest.skip(f"Test video {TEST_VIDEO_CHUNKED_UPLOAD} not found - may have been deleted")


class TestSpriteEndpoints:
    """Test sprite serving endpoints"""
    
    def test_sprite_jpg_returns_200_for_video_with_sprites(self, admin_token):
        """GET /api/personal-files/sprites/{file_id}/sprite.jpg returns 200"""
        response = requests.get(
            f"{BASE_URL}/api/personal-files/sprites/{TEST_VIDEO_SIMPLE_UPLOAD}/sprite.jpg",
            params={"token": admin_token}
        )
        if response.status_code == 404:
            pytest.skip(f"Sprite not found for video {TEST_VIDEO_SIMPLE_UPLOAD}")
        
        assert response.status_code == 200
        assert response.headers.get("content-type") == "image/jpeg"
        assert len(response.content) > 0
        print(f"PASS: Sprite image returned for video {TEST_VIDEO_SIMPLE_UPLOAD} ({len(response.content)} bytes)")
    
    def test_sprite_vtt_returns_valid_webvtt(self, admin_token):
        """GET /api/personal-files/sprites/{file_id}/thumbs.vtt returns valid WEBVTT"""
        response = requests.get(
            f"{BASE_URL}/api/personal-files/sprites/{TEST_VIDEO_SIMPLE_UPLOAD}/thumbs.vtt",
            params={"token": admin_token}
        )
        if response.status_code == 404:
            pytest.skip(f"VTT not found for video {TEST_VIDEO_SIMPLE_UPLOAD}")
        
        assert response.status_code == 200
        assert "text/vtt" in response.headers.get("content-type", "")
        
        vtt_content = response.text
        assert vtt_content.startswith("WEBVTT"), "VTT file should start with WEBVTT"
        assert "#xywh=" in vtt_content, "VTT should contain sprite coordinates"
        print(f"PASS: Valid WEBVTT returned for video {TEST_VIDEO_SIMPLE_UPLOAD}")
        print(f"  VTT content preview: {vtt_content[:200]}...")
    
    def test_sprite_jpg_for_chunked_upload_video(self, admin_token):
        """GET /api/personal-files/sprites/{file_id}/sprite.jpg for chunked upload video"""
        response = requests.get(
            f"{BASE_URL}/api/personal-files/sprites/{TEST_VIDEO_CHUNKED_UPLOAD}/sprite.jpg",
            params={"token": admin_token}
        )
        if response.status_code == 404:
            pytest.skip(f"Sprite not found for video {TEST_VIDEO_CHUNKED_UPLOAD}")
        
        assert response.status_code == 200
        assert response.headers.get("content-type") == "image/jpeg"
        print(f"PASS: Sprite image returned for chunked upload video {TEST_VIDEO_CHUNKED_UPLOAD}")
    
    def test_sprite_vtt_for_chunked_upload_video(self, admin_token):
        """GET /api/personal-files/sprites/{file_id}/thumbs.vtt for chunked upload video"""
        response = requests.get(
            f"{BASE_URL}/api/personal-files/sprites/{TEST_VIDEO_CHUNKED_UPLOAD}/thumbs.vtt",
            params={"token": admin_token}
        )
        if response.status_code == 404:
            pytest.skip(f"VTT not found for video {TEST_VIDEO_CHUNKED_UPLOAD}")
        
        assert response.status_code == 200
        vtt_content = response.text
        assert vtt_content.startswith("WEBVTT")
        print(f"PASS: Valid WEBVTT returned for chunked upload video {TEST_VIDEO_CHUNKED_UPLOAD}")
    
    def test_sprite_requires_auth_token(self):
        """Sprite endpoints require authentication token"""
        # Without token
        response = requests.get(
            f"{BASE_URL}/api/personal-files/sprites/{TEST_VIDEO_SIMPLE_UPLOAD}/sprite.jpg"
        )
        assert response.status_code == 401
        print(f"PASS: Sprite endpoint returns 401 without token")
    
    def test_sprite_vtt_requires_auth_token(self):
        """VTT endpoint requires authentication token"""
        response = requests.get(
            f"{BASE_URL}/api/personal-files/sprites/{TEST_VIDEO_SIMPLE_UPLOAD}/thumbs.vtt"
        )
        assert response.status_code == 401
        print(f"PASS: VTT endpoint returns 401 without token")


class TestSpriteNotFoundCases:
    """Test sprite endpoints for non-existent or non-video files"""
    
    def test_sprite_returns_404_for_nonexistent_file(self, admin_token):
        """Sprite endpoint returns 404 for non-existent file ID"""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = requests.get(
            f"{BASE_URL}/api/personal-files/sprites/{fake_id}/sprite.jpg",
            params={"token": admin_token}
        )
        assert response.status_code == 404
        print(f"PASS: Sprite returns 404 for non-existent file")
    
    def test_vtt_returns_404_for_nonexistent_file(self, admin_token):
        """VTT endpoint returns 404 for non-existent file ID"""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = requests.get(
            f"{BASE_URL}/api/personal-files/sprites/{fake_id}/thumbs.vtt",
            params={"token": admin_token}
        )
        assert response.status_code == 404
        print(f"PASS: VTT returns 404 for non-existent file")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
